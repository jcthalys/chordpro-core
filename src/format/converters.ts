/**
 * Format converters — Tier 2 auxiliary helpers.
 * Three converters that produce different text representations of a Song:
 *   toSimpleText    — natural human-readable text (no directives)
 *   toDirectiveText — clean ChordPro with directives
 *   toRawText       — full-fidelity ChordPro, equivalent to serialize()
 *
 * All three accept a `chords` option:
 *   'above' (default): chords on their own line above the lyric
 *   'inline':          chords as [G]word tokens within the lyric line
 */

import type { Song, Line, LyricLine, SectionNode } from '../model/types.js';
import { serialize } from '../parser/serialize.js';
import { toInline, toAbove } from '../chords/format.js';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface ConverterOptions {
  /** Chord display format. Default: 'above'. */
  chords?: 'above' | 'inline';
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function applyChordMode(song: Song, mode: 'above' | 'inline'): Song {
  return mode === 'above' ? toAbove(song) : toInline(song);
}

// Metadata keys emitted in order for toSimpleText.
// null label → emit value bare; string label → emit "Label: value".
const META_ORDER: ReadonlyArray<{ key: string; label: string | null }> = [
  { key: 'title',     label: null },
  { key: 'artist',    label: null },
  { key: 'composer',  label: 'Composer' },
  { key: 'lyricist',  label: 'Lyricist' },
  { key: 'key',       label: 'Key' },
  { key: 'capo',      label: 'Capo' },
  { key: 'tempo',     label: 'BPM' },
  { key: 'time',      label: 'Time' },
  { key: 'album',     label: 'Album' },
  { key: 'year',      label: 'Year' },
  { key: 'copyright', label: 'Copyright' },
  { key: 'ccli',      label: 'CCLI' },
];

// Keys skipped in the remaining-metadata pass (sort keys, multi-value, section-local).
const META_SKIP = new Set([
  'sorttitle', 'sortartist', 'tag', 'subtitle', 'duration', 'repeat',
]);

// Kind → heading text for kinds where the plain capitalized name does not
// round-trip through parseFreeText (e.g. 'prechorus' → 'Pre-Chorus').
const KIND_TO_HEADING: Readonly<Record<string, string>> = {
  verse:     'Verse',
  chorus:    'Chorus',
  bridge:    'Bridge',
  prechorus: 'Pre-Chorus',
  tab:       'Tab',
  grid:      'Grid',
  custom:    'Section',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── toSimpleText internals ───────────────────────────────────────────────────

/**
 * Serialize a LyricLine to plain text.
 * In 'above' mode, chord-only lines emit bare chord names (no brackets) so
 * that parseFreeText can recognise them as chord-above-lyrics lines on
 * a round-trip. All other lines use ChordPro inline notation ([G]word).
 */
function serializeLyricLineSimple(line: LyricLine, isAbove: boolean): string {
  const isChordOnly =
    line.segments.some((s) => s.chord !== undefined || s.annotation !== undefined) &&
    line.segments.every((s) => s.lyric.trim() === '');

  if (isAbove && isChordOnly) {
    let result = '';
    for (const seg of line.segments) {
      if (seg.chord !== undefined) {
        result += seg.chord.name + seg.lyric;
      } else if (seg.annotation !== undefined) {
        // Keep annotation bracket syntax so it is not misidentified as a chord.
        result += `[*${seg.annotation}]` + seg.lyric;
      } else {
        result += seg.lyric;
      }
    }
    return result.trimEnd();
  }

  return line.segments
    .map((seg) => {
      if (seg.chord !== undefined) return `[${seg.chord.name}]${seg.lyric}`;
      if (seg.annotation !== undefined) return `[*${seg.annotation}]${seg.lyric}`;
      return seg.lyric;
    })
    .join('');
}

function renderBodySimple(lines: Line[], isAbove: boolean): string[] {
  const out: string[] = [];
  for (const line of lines) {
    switch (line.type) {
      case 'blank':
        out.push('');
        break;
      case 'comment':
        out.push(line.text);
        break;
      case 'lyric':
        out.push(serializeLyricLineSimple(line, isAbove));
        break;
      case 'section':
        out.push(...renderSectionSimple(line, isAbove));
        break;
      case 'directive':
        // Comment directives become # lines; all other directives are omitted
        // (metadata is emitted from song.metadata; layout directives stripped).
        if (['comment', 'comment_italic', 'comment_box'].includes(line.name)) {
          out.push(`# ${line.argument ?? ''}`);
        }
        break;
      case 'chorus_reference':
        out.push('Chorus');
        break;
      case 'tab_line':
        out.push(line.text);
        break;
      case 'grid_row':
        out.push(
          line.source !== undefined
            ? line.source
            : line.cells.map((c) => c.chords.map((ch) => ch.name).join(' ')).join(' | '),
        );
        break;
      case 'chord_def':
        // Chord definitions have no natural-text equivalent; omit.
        break;
    }
  }
  return out;
}

function renderSectionSimple(section: SectionNode, isAbove: boolean): string[] {
  const out: string[] = [];

  if (section.delegated) {
    // Preserve delegated blocks (abc, ly, svg…) verbatim.
    if (section.rawContent) out.push(section.rawContent);
    out.push('');
    return out;
  }

  // Use stored label when available; fall back to kind-to-heading mapping so
  // parseFreeText can re-detect the section kind on a round-trip.
  // Normalise compact labels: "Verse1" → "Verse 1" so the round-trip works.
  const rawHeading =
    section.label ?? KIND_TO_HEADING[section.kind] ?? capitalize(section.kind);
  const heading = rawHeading.replace(/([A-Za-zÀ-ÿ])(\d+)$/, '$1 $2');
  out.push(heading);

  for (const child of section.lines) {
    out.push(...renderBodySimple([child], isAbove));
  }

  // Blank line to separate sections.
  out.push('');
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a Song to natural human-readable plain text (no ChordPro directives).
 *
 * - Metadata emitted as natural-text lines (title/artist bare, others as "Key: G" etc.)
 * - Sections emitted as plain headings + content, separated by blank lines
 * - Chord display controlled by `options.chords` (default: 'above'):
 *   - 'above': chord names on their own line without brackets (parseFreeText-compatible)
 *   - 'inline': [G]word inline notation
 * - Comment directives become `# …` lines; all other directives are omitted
 *
 * Round-trip contract: `parseFreeText(toSimpleText(song))` reconstructs the same
 * metadata and section structure as the original song. Chord column positions may
 * have minor whitespace normalization. Non-standard `{meta:}` keys that do not match
 * a parseFreeText pattern will not survive the round-trip (documented limitation).
 *
 * Tier 2 auxiliary helper.
 */
export function toSimpleText(song: Song, options: ConverterOptions = {}): string {
  const mode = options.chords ?? 'above';
  const processed = applyChordMode(song, mode);

  const parts: string[] = [];

  // ── Metadata block ───────────────────────────────────────────────────────────
  const handled = new Set<string>();
  const metaLines: string[] = [];

  for (const { key, label } of META_ORDER) {
    const val = processed.metadata.get(key);
    if (val === undefined) continue;
    // {capo: 0} means "no capo" — omit from natural-text output.
    if (key === 'capo' && val.trim() === '0') { handled.add(key); continue; }
    metaLines.push(label === null ? val : `${label}: ${val}`);
    handled.add(key);
  }

  // Remaining metadata as "key: value" (e.g. {meta: ritmo Baião} → "ritmo: Baião").
  for (const [k, v] of processed.metadata) {
    if (!handled.has(k) && !META_SKIP.has(k)) {
      metaLines.push(`${k}: ${v}`);
    }
  }

  if (metaLines.length > 0) {
    parts.push(...metaLines);
  }

  // ── Body ─────────────────────────────────────────────────────────────────────
  const body = renderBodySimple(processed.lines, mode === 'above');

  // Strip both leading and trailing blank lines from body so the separator
  // between metadata and body is always exactly one blank line, regardless
  // of how many blank lines the source ChordPro has between directives and
  // the first section.  Without this, each round-trip through Simple mode
  // accumulates an extra blank line.
  while (body.length > 0 && body[body.length - 1] === '') body.pop();
  while (body.length > 0 && body[0] === '') body.shift();

  if (metaLines.length > 0 && body.length > 0) parts.push('');
  parts.push(...body);

  return parts.join('\n');
}

/**
 * Convert a Song to clean standard ChordPro with directives.
 * Metadata appears as `{title:}`, `{artist:}`, `{key:}`, etc. tags;
 * sections as `{start_of_verse}/{end_of_verse}` etc.
 * Chord display controlled by `options.chords` (default: 'above').
 *
 * For a song already in ChordPro, this produces output equivalent to
 * `serialize()` with the chord mode applied. All existing directives
 * (including advanced/layout ones) are preserved but not reordered.
 *
 * Tier 2 auxiliary helper.
 */
export function toDirectiveText(song: Song, options: ConverterOptions = {}): string {
  const mode = options.chords ?? 'above';
  return serialize(applyChordMode(song, mode));
}

/**
 * Convert a Song to full-fidelity ChordPro source.
 * Equivalent to `serialize()` with the chord mode applied — all directives,
 * chord definitions, delegated blocks, and layout/legacy directives are
 * preserved verbatim.
 * Chord display controlled by `options.chords` (default: 'above').
 *
 * `toRawText(song, { chords: 'inline' })` ≈ `serialize(song)` for a song with
 * inline chords.
 *
 * Tier 2 auxiliary helper.
 */
export function toRawText(song: Song, options: ConverterOptions = {}): string {
  const mode = options.chords ?? 'above';
  return serialize(applyChordMode(song, mode));
}
