/**
 * parseFreeText — Tier 2 auxiliary helper.
 * Converts loose human-written text to canonical ChordPro + extracted metadata.
 * NOT part of the ChordPro format.
 *
 * @remarks
 * This is an auxiliary helper, not part of the ChordPro format specification.
 */

import { parseChord } from '../chords/parseChord.js';
import { guessKey } from '../analysis/guessKey.js';
import type { Warning } from '../model/types.js';

export interface ParseFreeTextResult {
  /** Canonical ChordPro output (re-parseable with zero warnings for well-formed input). */
  chordpro: string;
  /** Extracted metadata. */
  metadata: Map<string, string>;
  /** Non-fatal warnings from the conversion process. */
  warnings: Warning[];
}

// ─── Section heading detection ────────────────────────────────────────────────

interface HeadingMatch {
  kind: 'chorus' | 'verse' | 'bridge' | 'prechorus';
  label?: string;
}

function matchHeading(line: string): HeadingMatch | null {
  const trimmed = line.trim();
  // Bracketed: [Chorus], [Verse 1], [Bridge], [Refrão]
  const bracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
  const text = bracketMatch ? bracketMatch[1]!.trim() : trimmed;

  const lower = text.toLowerCase();

  // Chorus / Coro / Refrão
  if (/^(chorus|coro|refr[aã]o|refrão)/i.test(text)) return { kind: 'chorus', label: text };
  // Verse / Verso
  if (/^(verse|verso)/i.test(text)) return { kind: 'verse', label: text };
  // Bridge / Ponte
  if (/^(bridge|ponte)/i.test(text)) return { kind: 'bridge', label: text };
  // Pre-chorus / Pré-refrão
  if (/^(pre[- ]?chorus|pré[- ]?refr[aã]o|pre[- ]?coro)/i.test(text)) return { kind: 'prechorus', label: text };

  // Bare single-word or multi-word headings without bracket
  if (!bracketMatch) {
    // Only match if it looks like a heading (short, titlecase-ish)
    if (/^(chorus|verse|bridge|pre[- ]?chorus|coro|refr[aã]o|verso|ponte)/i.test(lower)) {
      return { kind: lowerToKind(lower), label: text };
    }
    return null;
  }

  // Bracketed heading matching above
  if (/^(chorus|coro|refr[aã]o)/i.test(lower)) return { kind: 'chorus', label: text };
  if (/^(verse|verso)/i.test(lower)) return { kind: 'verse', label: text };
  if (/^(bridge|ponte)/i.test(lower)) return { kind: 'bridge', label: text };
  if (/^(pre[- ]?chorus|pré[- ]?refr[aã]o)/i.test(lower)) return { kind: 'prechorus', label: text };

  return null;
}

function lowerToKind(lower: string): 'chorus' | 'verse' | 'bridge' | 'prechorus' {
  if (/chorus|coro|refr/.test(lower)) return 'chorus';
  if (/verse|verso/.test(lower)) return 'verse';
  if (/bridge|ponte/.test(lower)) return 'bridge';
  return 'prechorus';
}

// ─── Metadata line detection ──────────────────────────────────────────────────

interface MetaLine {
  key: string;
  value: string;
}

const META_PATTERNS: Array<[RegExp, string]> = [
  [/^key\s*:\s*(.+)$/i, 'key'],
  [/^tom\s*:\s*(.+)$/i, 'key'],       // Portuguese alias for Key
  [/^tempo\s*:\s*(.+)$/i, 'tempo'],
  [/^bpm\s*:\s*(.+)$/i, 'tempo'],
  [/^capo\s*:\s*(.+)$/i, 'capo'],
  [/^time\s*:\s*(.+)$/i, 'time'],
  [/^ccli\s*:\s*(.+)$/i, 'ccli'],
];

function matchMetaLine(line: string): MetaLine | null {
  const trimmed = line.trim();
  for (const [re, key] of META_PATTERNS) {
    const m = trimmed.match(re);
    if (m) return { key, value: m[1]!.trim() };
  }
  return null;
}

// ─── Chord-only line detection ────────────────────────────────────────────────

/**
 * Returns true if line is a chord-only line (≥80% of tokens parseable as chords).
 * Uses strict mode to avoid treating normal words starting with note letters (e.g.
 * "Amazing", "Grace") as chord tokens.
 */
function isChordOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  // Require at least one token to actually look like a chord
  // (has note letter + optional modifier, not just any word)
  let parsed = 0;
  for (const tok of tokens) {
    const chord = parseChord(tok, { mode: 'strict' });
    if (chord.parsed) parsed++;
  }

  return tokens.length > 0 && parsed / tokens.length >= 0.8;
}

// ─── Chord-above-lyrics merge ─────────────────────────────────────────────────

/** Merge a chord-only line with the following lyrics line into inline ChordPro. */
function mergeChordAboveLyrics(chordLine: string, lyricLine: string): string {
  // Parse chord tokens with their column positions
  const chordTokens: Array<{ col: number; name: string }> = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) {
    chordTokens.push({ col: m.index, name: m[0]! });
  }

  if (chordTokens.length === 0) return lyricLine;

  // For each chord, find the nearest word boundary at or after its column
  let result = '';
  let lyricPos = 0;

  for (let i = 0; i < chordTokens.length; i++) {
    const token = chordTokens[i]!;

    // Target column in the lyric line (clamped)
    let insertAt = Math.min(token.col, lyricLine.length);

    // Snap forward to the next non-space character (word boundary)
    while (insertAt < lyricLine.length && lyricLine[insertAt] === ' ') {
      insertAt++;
    }

    // If we've already passed insertAt, keep current position
    if (insertAt < lyricPos) insertAt = lyricPos;

    // Emit lyric up to insertAt
    result += lyricLine.slice(lyricPos, insertAt);
    lyricPos = insertAt;

    // Emit the chord token
    result += `[${token.name}]`;

    // Lyric for this chord's span is emitted on the next iteration
  }

  // Emit remaining lyric
  result += lyricLine.slice(lyricPos);

  return result;
}

// ─── Main function ────────────────────────────────────────────────────────────

/** Convert loosely-formatted human text to canonical ChordPro. */
export function parseFreeText(input: string): ParseFreeTextResult {
  const metadata = new Map<string, string>();
  const warnings: Warning[] = [];

  const rawLines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // ── Pass 1: identify title, artist, metadata lines ──────────────────────
  let titleFound = false;
  let artistFound = false;
  const processedLines: Array<
    | { kind: 'title'; text: string }
    | { kind: 'artist'; text: string }
    | { kind: 'meta'; key: string; value: string }
    | { kind: 'heading'; match: HeadingMatch }
    | { kind: 'chord_only'; text: string }
    | { kind: 'lyric'; text: string }
    | { kind: 'blank' }
    | { kind: 'directive'; text: string }
  > = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i] ?? '';
    const trimmed = raw.trim();

    if (!trimmed) {
      processedLines.push({ kind: 'blank' });
      continue;
    }

    // Already a ChordPro directive
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      processedLines.push({ kind: 'directive', text: trimmed });
      continue;
    }

    // Metadata line (Key:, Tempo:, etc.)
    const meta = matchMetaLine(trimmed);
    if (meta) {
      metadata.set(meta.key, meta.value);
      processedLines.push({ kind: 'meta', key: meta.key, value: meta.value });
      continue;
    }

    // Section heading
    const heading = matchHeading(trimmed);
    if (heading) {
      processedLines.push({ kind: 'heading', match: heading });
      continue;
    }

    // Chord-only line
    if (isChordOnlyLine(trimmed)) {
      processedLines.push({ kind: 'chord_only', text: trimmed });
      continue;
    }

    // Title / artist detection (first two non-chord, non-meta, non-heading content lines)
    if (!titleFound) {
      titleFound = true;
      metadata.set('title', trimmed);
      processedLines.push({ kind: 'title', text: trimmed });
      continue;
    }
    if (!artistFound) {
      artistFound = true;
      metadata.set('artist', trimmed);
      processedLines.push({ kind: 'artist', text: trimmed });
      continue;
    }

    processedLines.push({ kind: 'lyric', text: trimmed });
  }

  // ── Key auto-detection if no Key:/Tom: found ─────────────────────────────
  if (!metadata.has('key')) {
    // Convert chord-only tokens into inline ChordPro format so guessKey can parse them
    const chordSource = processedLines
      .filter((pl) => pl.kind === 'chord_only')
      .flatMap((pl) => pl.text.split(/\s+/).filter(Boolean))
      .map((name) => `[${name}]`)
      .join(' ');
    if (chordSource.trim()) {
      const guess = guessKey(chordSource);
      if (guess && guess.confidence >= 0.5) {
        metadata.set('key', guess.key);
      }
    }
  }

  // ── Pass 2: emit ChordPro ─────────────────────────────────────────────────
  const outputLines: string[] = [];

  // Emit metadata directives
  for (const [key, value] of metadata) {
    outputLines.push(`{${key}: ${value}}`);
  }

  // Track current section
  let currentSection: string | null = null;

  function closeSection(): void {
    if (currentSection) {
      outputLines.push(`{end_of_${currentSection}}`);
      currentSection = null;
    }
  }

  function openSection(kind: string, label?: string): void {
    closeSection();
    const labelAttr = label ? ` label="${label}"` : '';
    outputLines.push(`{start_of_${kind}${labelAttr}}`);
    currentSection = kind;
  }

  let i = 0;
  while (i < processedLines.length) {
    const pl = processedLines[i]!;

    switch (pl.kind) {
      case 'title':
      case 'artist':
      case 'meta':
        // Already emitted as metadata directives
        i++;
        break;

      case 'blank':
        if (currentSection === null) outputLines.push('');
        i++;
        break;

      case 'directive':
        outputLines.push(pl.text);
        i++;
        break;

      case 'heading':
        openSection(pl.match.kind, pl.match.label);
        i++;
        break;

      case 'chord_only': {
        // Look ahead: if next non-blank line is a lyric, merge
        let j = i + 1;
        while (j < processedLines.length && processedLines[j]!.kind === 'blank') j++;
        const next = j < processedLines.length ? processedLines[j]! : null;
        if (next && next.kind === 'lyric') {
          const merged = mergeChordAboveLyrics(pl.text, next.text);
          outputLines.push(merged);
          i = j + 1;
        } else {
          // Orphan chord line — emit as lyric with chords in brackets
          const chordLine = pl.text.split(/\s+/).map((c) => `[${c}]`).join(' ');
          outputLines.push(chordLine);
          i++;
        }
        break;
      }

      case 'lyric':
        outputLines.push(pl.text);
        i++;
        break;
    }
  }

  closeSection();

  return { chordpro: outputLines.join('\n'), metadata, warnings };
}
