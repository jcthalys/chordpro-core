/**
 * Transposition — Tier 1.
 * Pure functions; never mutate input.
 */

import type { Chord, Song, Line, LyricLine, SectionNode, Segment, GridRow } from '../model/types.js';
import { parseChord } from './parseChord.js';

/**
 * Parse the argument of a `{transpose: N}` directive.
 * Supports optional trailing `s` (prefer sharps) or `f` (prefer flats).
 * Empty / missing argument → semitones: 0 (cancellation).
 */
function parseTransposeValue(arg: string | undefined): { semitones: number; opts: TransposeOptions } {
  if (!arg || arg.trim() === '') return { semitones: 0, opts: {} };
  let value = arg.trim();
  let opts: TransposeOptions = {};
  if (value.endsWith('s')) { opts = { preferSharps: true }; value = value.slice(0, -1); }
  else if (value.endsWith('f')) { opts = { preferFlats: true }; value = value.slice(0, -1); }
  const semitones = parseInt(value, 10);
  return isNaN(semitones) ? { semitones: 0, opts: {} } : { semitones, opts };
}

export interface TransposeOptions {
  /** Prefer sharps (default: infer from root; use sharps when ambiguous). */
  preferSharps?: boolean;
  /** Prefer flats. */
  preferFlats?: boolean;
}

// Chromatic scale (sharps)
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Chromatic scale (flats)
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map root note names → semitone index (0-11)
const ROOT_TO_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  'C#': 1, Db: 1, 'D#': 3, Eb: 3, 'E#': 5, Fb: 4,
  'F#': 6, Gb: 6, 'G#': 8, Ab: 8, 'A#': 10, Bb: 10,
  'B#': 0, Cb: 11,
  // German H = B
  H: 11, 'H#': 0, Hb: 10,
  // Solfège-style alternate spellings
  Bes: 10, Hes: 10, Cis: 1, Des: 1, Dis: 3, Es: 3, Fis: 6, Ges: 6,
  Gis: 8, As: 8, Ais: 10,
};

/** Whether a root uses a flat (so transposing should prefer flats by default). */
function rootUsesFlat(root: string): boolean {
  return root.endsWith('b') || root === 'Bb' || root === 'Eb' || root === 'Ab' ||
    root === 'Db' || root === 'Gb' || root === 'Bes' || root === 'Hes' ||
    root === 'Des' || root === 'Es' || root === 'Ges' || root === 'As';
}

/** Transpose a single root note by semitones. */
function transposeRoot(root: string, semitones: number, opts: TransposeOptions): string {
  const semitone = ROOT_TO_SEMITONE[root];
  if (semitone === undefined) return root; // unknown root — pass through

  const newSt = ((semitone + semitones) % 12 + 12) % 12;
  const useFlatsByDefault = rootUsesFlat(root);
  const useFlats = opts.preferFlats === true || (useFlatsByDefault && opts.preferSharps !== true);
  const scale = useFlats ? FLATS : SHARPS;
  return scale[newSt] ?? root;
}

/** Transpose a parsed Chord by semitones. Unparsed chords and annotations pass through unchanged. */
export function transposeChord(chord: Chord, semitones: number, opts: TransposeOptions = {}): Chord {
  if (!chord.parsed || chord.root === undefined) return chord;

  const newRoot = transposeRoot(chord.root, semitones, opts);
  const newBass = chord.bass !== undefined ? transposeRoot(chord.bass, semitones, opts) : undefined;

  // Reconstruct name
  let newName = newRoot;
  if (chord.qualifier !== undefined) newName += chord.qualifier;
  if (chord.extension !== undefined) newName += chord.extension;
  if (newBass !== undefined) newName += `/${newBass}`;

  const result: Chord = { ...chord, name: newName, root: newRoot };
  if (newBass !== undefined) result.bass = newBass;
  else delete result.bass;
  return result;
}

/** Transpose all chords in a Song by semitones. Returns a new Song (immutable). */
export function transpose(song: Song, semitones: number, opts: TransposeOptions = {}): Song {
  if (semitones === 0) return song;

  const newLines = song.lines.map((line) => transposeLine(line, semitones, opts));

  // Also transpose the key metadata if present
  const newMeta = new Map(song.metadata);
  const key = newMeta.get('key');
  if (key) {
    const keyChord = parseChord(key, { mode: 'relaxed' });
    if (keyChord.parsed && keyChord.root) {
      const newKeyRoot = transposeRoot(keyChord.root, semitones, opts);
      // Preserve qualifier (e.g. "Am" → "Bm", not "B")
      const qualifier = keyChord.qualifier ?? '';
      newMeta.set('key', newKeyRoot + qualifier);
    }
  }

  return { ...song, metadata: newMeta, lines: newLines };
}

/**
 * Apply in-song `{transpose: N}` directives to the chord content that follows them.
 * Each directive shifts all subsequent chords by N semitones; `{transpose}` (no value)
 * cancels the current transposition. Trailing `s`/`f` on the value sets sharps/flats.
 *
 * This is the rendering-time counterpart of the programmatic `transpose()` API.
 * `renderText` and `renderHtml` call this automatically per the spec.
 */
export function applyTransposeDirectives(song: Song): Song {
  let semitones = 0;
  let transOpts: TransposeOptions = {};

  function processLines(lines: Line[]): Line[] {
    return lines.map((line) => {
      if (line.type === 'directive' && line.name === 'transpose') {
        const parsed = parseTransposeValue(line.argument);
        semitones = parsed.semitones;
        transOpts = parsed.opts;
        return line; // keep the directive node for round-trip
      }
      if (line.type === 'section') {
        return { ...line, lines: processLines(line.lines) };
      }
      return semitones !== 0 ? transposeLine(line, semitones, transOpts) : line;
    });
  }

  const newLines = processLines(song.lines);
  return { ...song, lines: newLines };
}

function transposeLine(line: Line, semitones: number, opts: TransposeOptions): Line {
  switch (line.type) {
    case 'lyric':
      return transposeLyricLine(line, semitones, opts);
    case 'section':
      return transposeSectionNode(line, semitones, opts);
    case 'grid_row':
      return transposeGridRow(line, semitones, opts);
    case 'blank':
    case 'comment':
    case 'directive':
    case 'chorus_reference':
    case 'tab_line':
      return line;
  }
}

function transposeLyricLine(line: LyricLine, semitones: number, opts: TransposeOptions): LyricLine {
  return {
    type: 'lyric',
    segments: line.segments.map((seg) => transposeSegment(seg, semitones, opts)),
  };
}

function transposeSegment(seg: Segment, semitones: number, opts: TransposeOptions): Segment {
  if (seg.chord === undefined) return seg;
  return { ...seg, chord: transposeChord(seg.chord, semitones, opts) };
}

function transposeGridRow(row: GridRow, semitones: number, opts: TransposeOptions): GridRow {
  return {
    type: 'grid_row',
    cells: row.cells.map((cell) => ({
      chords: cell.chords.map((ch) => transposeChord(ch, semitones, opts)),
    })),
    // source is intentionally dropped — row was transposed, must be reconstructed
  };
}

function transposeSectionNode(section: SectionNode, semitones: number, opts: TransposeOptions): SectionNode {
  // Don't transpose inside tab or delegated sections
  if (section.kind === 'tab' || section.delegated) return section;
  return {
    ...section,
    lines: section.lines.map((l) => transposeLine(l, semitones, opts)),
  };
}
