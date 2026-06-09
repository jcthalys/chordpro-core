/**
 * Format converters — Tier 2 auxiliary helpers.
 * Pure transforms between chord-above-lyrics and inline [G]word formats.
 * Neither function mutates its input; both return new Song objects.
 */

import type { Song, Line, LyricLine, Segment, Chord } from '../model/types.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * A chord-only line has at least one chord/annotation and every segment's
 * lyric is empty or whitespace. This is the AST-level equivalent of a
 * "G     C" line in the chords-above-lyrics text format.
 */
function isChordOnlyLine(line: LyricLine): boolean {
  const hasChordOrAnnotation = line.segments.some(
    (s) => s.chord !== undefined || s.annotation !== undefined,
  );
  if (!hasChordOrAnnotation) return false;
  return line.segments.every((s) => s.lyric.trim() === '');
}

/** (col, chord/annotation) pair extracted from a chord-only line. */
type ChordToken = { col: number; chord?: Chord; annotation?: string };

/**
 * Walk a chord-only LyricLine and record each chord/annotation together with
 * its visual column position. Column accounting mirrors the colWidth formula
 * used when building the line in splitLineToAbove.
 */
function extractChordTokens(line: LyricLine): ChordToken[] {
  const tokens: ChordToken[] = [];
  let col = 0;
  for (const seg of line.segments) {
    if (seg.chord !== undefined) {
      tokens.push({ col, chord: seg.chord });
      col += seg.chord.name.length + seg.lyric.length;
    } else if (seg.annotation !== undefined) {
      tokens.push({ col, annotation: seg.annotation });
      col += seg.annotation.length + seg.lyric.length;
    } else {
      col += seg.lyric.length;
    }
  }
  return tokens;
}

/**
 * Distribute chord tokens into a lyric line, producing a new inline LyricLine.
 * Column positions are matched Unicode-safely using code-point counting.
 * When a chord lands past a space run, it snaps forward to the next word boundary.
 * This is the AST-level counterpart of parseFreeText's mergeChordAboveLyrics.
 */
function mergeTokensIntoLyric(tokens: ChordToken[], lyricLine: LyricLine): LyricLine {
  if (tokens.length === 0) return lyricLine;

  const lyricText = lyricLine.segments.map((s) => s.lyric).join('');
  const lyricCps = [...lyricText]; // code-point array for Unicode safety
  const newSegs: Segment[] = [];
  let lyricPos = 0;

  for (const token of tokens) {
    // Target column, clamped to lyric length
    let insertAt = Math.min(token.col, lyricCps.length);
    // Snap forward past spaces to word boundary
    while (insertAt < lyricCps.length && lyricCps[insertAt] === ' ') insertAt++;
    // Never go backwards (handles overlapping chord names)
    if (insertAt < lyricPos) insertAt = lyricPos;

    // Text between the previous insertion point and here
    const textBetween = lyricCps.slice(lyricPos, insertAt).join('');
    lyricPos = insertAt;

    if (textBetween.length > 0) {
      if (newSegs.length === 0) {
        // Leading text before the first chord → lyric-only segment
        newSegs.push({ lyric: textBetween });
      } else {
        // Text between two chords → append to the previous segment's lyric
        newSegs[newSegs.length - 1]!.lyric += textBetween;
      }
    }

    // Chord/annotation segment; lyric text filled by subsequent tokens or the tail below
    const seg: Segment = { lyric: '' };
    if (token.chord !== undefined) seg.chord = token.chord;
    if (token.annotation !== undefined) seg.annotation = token.annotation;
    newSegs.push(seg);
  }

  // Remaining lyric goes into the last segment
  const remaining = lyricCps.slice(lyricPos).join('');
  if (newSegs.length > 0) {
    newSegs[newSegs.length - 1]!.lyric += remaining;
  } else {
    newSegs.push({ lyric: remaining });
  }

  return { type: 'lyric', segments: newSegs };
}

/**
 * Split an inline LyricLine into [chordOnlyLine, lyricOnlyLine].
 * Returns null when the line is already chord-only or has no chords (nothing to split).
 * Uses the same colWidth formula as renderText for column alignment.
 */
function splitLineToAbove(line: LyricLine): [LyricLine, LyricLine] | null {
  const hasChordOrAnnotation = line.segments.some(
    (s) => s.chord !== undefined || s.annotation !== undefined,
  );
  if (!hasChordOrAnnotation) return null; // pure lyric — nothing to split

  if (line.segments.every((s) => s.lyric.trim() === '')) return null; // already chord-only

  const chordSegs: Segment[] = [];
  const lyricSegs: Segment[] = [];

  for (const seg of line.segments) {
    const chordText = seg.chord?.name ?? seg.annotation ?? '';
    const lyric = seg.lyric;

    if (chordText) {
      // colWidth: same formula as renderText so column positions are consistent
      const colWidth = Math.max(chordText.length + 1, lyric.length);
      const spacing = ' '.repeat(colWidth - chordText.length);
      if (seg.chord !== undefined) {
        chordSegs.push({ chord: seg.chord, lyric: spacing });
      } else {
        chordSegs.push({ annotation: seg.annotation!, lyric: spacing });
      }
      lyricSegs.push({ lyric });
    } else {
      // Pure lyric segment: mirror column width in chord line as spaces
      chordSegs.push({ lyric: ' '.repeat(lyric.length) });
      lyricSegs.push({ lyric });
    }
  }

  // Trim trailing whitespace from the chord line's last segment
  const last = chordSegs[chordSegs.length - 1];
  if (last) chordSegs[chordSegs.length - 1] = { ...last, lyric: last.lyric.trimEnd() };

  return [
    { type: 'lyric', segments: chordSegs },
    { type: 'lyric', segments: lyricSegs },
  ];
}

function processLinesInline(lines: Line[]): Line[] {
  const result: Line[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.type === 'lyric' && isChordOnlyLine(line)) {
      const next = lines[i + 1];
      // Merge only when the immediately following line is a non-chord-only lyric line
      if (next !== undefined && next.type === 'lyric' && !isChordOnlyLine(next)) {
        result.push(mergeTokensIntoLyric(extractChordTokens(line), next));
        i += 2;
        continue;
      }
    }
    if (line.type === 'section') {
      result.push({ ...line, lines: processLinesInline(line.lines) });
    } else {
      result.push(line);
    }
    i++;
  }
  return result;
}

function processLinesAbove(lines: Line[]): Line[] {
  const result: Line[] = [];
  for (const line of lines) {
    if (line.type === 'lyric') {
      const split = splitLineToAbove(line);
      if (split !== null) {
        result.push(split[0]);
        result.push(split[1]);
      } else {
        result.push(line);
      }
    } else if (line.type === 'section') {
      result.push({ ...line, lines: processLinesAbove(line.lines) });
    } else {
      result.push(line);
    }
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a song from chords-above-lyrics format to inline [G]word format.
 * Each chord-only line is merged with the immediately following lyric line
 * using Unicode-aware column matching. Chord positions snap forward to the
 * next word boundary when they land inside a space run.
 *
 * Lines that already have inline chords, and all non-lyric lines (directives,
 * blanks, sections, tab/grid rows), pass through unchanged. Processing recurses
 * into section environments.
 *
 * Pure transform — returns a new Song; does not mutate input.
 * Tier 2 auxiliary helper.
 */
export function toInline(song: Song): Song {
  return { ...song, lines: processLinesInline(song.lines) };
}

/**
 * Convert a song from inline [G]word format to chords-above-lyrics format.
 * Each lyric line that contains inline chords is split into two consecutive
 * lines: a chord-only line above, then a lyric-only line. Column widths follow
 * the same formula as `renderText` so the visual alignment is consistent.
 *
 * Lines that are already chord-only, pure lyric lines with no chords, and all
 * non-lyric lines (directives, blanks, sections, tab/grid rows), pass through
 * unchanged. Processing recurses into section environments.
 *
 * Pure transform — returns a new Song; does not mutate input.
 * Tier 2 auxiliary helper.
 */
export function toAbove(song: Song): Song {
  return { ...song, lines: processLinesAbove(song.lines) };
}
