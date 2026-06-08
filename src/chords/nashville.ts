/**
 * Nashville Number System (NNS) conversion — Tier 2 auxiliary helper.
 * Converts chord roots to/from scale degrees relative to a key.
 *
 * @remarks
 * Auxiliary helper, not part of the ChordPro format specification.
 */

import type { Song, Line, LyricLine, Segment, Chord, GridRow } from '../model/types.js';
import { parseChord } from './parseChord.js';

// Chromatic semitone table
const SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  'C#': 1, Db: 1, 'D#': 3, Eb: 3, 'E#': 5, Fb: 4,
  'F#': 6, Gb: 6, 'G#': 8, Ab: 8, 'A#': 10, Bb: 10,
  'B#': 0, Cb: 11,
  H: 11,
  Bes: 10, Hes: 10, Cis: 1, Des: 1, Dis: 3, Es: 3,
  Fis: 6, Ges: 6, Gis: 8, As: 8, Ais: 10,
};

// Major scale intervals (semitones from root for degrees 1-7)
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

// Natural note names (natural semitones only)
const NATURAL: Record<number, string> = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
const SHARP_NAME: Record<number, string> = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };
const FLAT_NAME: Record<number, string> = { 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' };

function keyUsesFlats(keySt: number): boolean {
  return [5, 10, 3, 8, 1, 6].includes(keySt); // F Bb Eb Ab Db Gb
}

function semitoneToRoot(st: number, useFlats: boolean): string {
  return NATURAL[st] ?? (useFlats ? FLAT_NAME[st] : SHARP_NAME[st]) ?? '?';
}

// ─── Degree map (absolute semitone → degree label '1'-'7') ───────────────────
// Stored as absolute semitones so lookup by absolute input is direct.

function buildDegreeMap(keySt: number): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 0; i < 7; i++) {
    map.set((keySt + MAJOR_SCALE[i]!) % 12, String(i + 1));
  }
  return map;
}

// ─── To Nashville ─────────────────────────────────────────────────────────────

function rootToNashville(root: string, degreeMap: Map<number, string>): string {
  const st = SEMITONE[root];
  if (st === undefined) return root;
  const degree = degreeMap.get(st);
  if (degree) return degree;

  // Chromatic: prefer flat of the next higher scale degree (b7, b3, b6…)
  const upperSt = (st + 1) % 12;
  const upperDeg = degreeMap.get(upperSt);
  if (upperDeg) return `b${upperDeg}`;

  // Fallback: sharp of the lower scale degree
  const lowerSt = ((st - 1) + 12) % 12;
  const lowerDeg = degreeMap.get(lowerSt);
  if (lowerDeg) return `#${lowerDeg}`;

  return '?';
}

function chordToNashville(chord: Chord, degreeMap: Map<number, string>): Chord {
  if (!chord.parsed || chord.root === undefined) return chord;
  const rootLabel = rootToNashville(chord.root, degreeMap);
  let newName = rootLabel;
  if (chord.qualifier !== undefined) newName += chord.qualifier;
  if (chord.extension !== undefined) newName += chord.extension;
  let newBass: string | undefined;
  if (chord.bass !== undefined) {
    const bassLabel = rootToNashville(chord.bass, degreeMap);
    newBass = bassLabel;
    newName += `/${bassLabel}`;
  }
  const result: Chord = { ...chord, name: newName, root: rootLabel };
  if (newBass !== undefined) result.bass = newBass;
  else delete result.bass;
  return result;
}

// ─── From Nashville ───────────────────────────────────────────────────────────

// Parse a Nashville root label: optional #/b prefix + digit 1-7
function parseNashvilleLabel(label: string): { st: number; ok: boolean } | null {
  const m = label.match(/^([#b]?)([1-7])$/);
  if (!m) return null;
  const degree = parseInt(m[2]!, 10) - 1; // 0-based index
  const base = MAJOR_SCALE[degree]!;
  const shift = m[1] === '#' ? 1 : m[1] === 'b' ? -1 : 0;
  return { st: (base + shift + 12) % 12, ok: true };
}

// Extract the Nashville root label from the front of a chord name
// e.g. 'b7m7' → 'b7', '1' → '1', '#4sus2' → '#4'
function extractNashvilleRoot(name: string): string | null {
  const m = name.match(/^([#b]?[1-7])/);
  return m ? m[1]! : null;
}

function chordFromNashville(chord: Chord, keySt: number, useFlats: boolean): Chord {
  // Get root label from chord.root (set by toNashville) or parse from chord.name
  const rootLabel = (chord.root && parseNashvilleLabel(chord.root))
    ? chord.root
    : extractNashvilleRoot(chord.name);
  if (!rootLabel) return chord;

  const parsed = parseNashvilleLabel(rootLabel);
  if (!parsed) return chord;
  const rootSt = (keySt + parsed.st) % 12;
  const newRoot = semitoneToRoot(rootSt, useFlats);

  // Get qualifier/extension from parsed fields or by stripping root from name
  let qualifier = chord.qualifier ?? '';
  let extension = chord.extension ?? '';
  let bassLabel: string | undefined = chord.bass;

  if (!chord.parsed || chord.root === undefined) {
    const rest = chord.name.slice(rootLabel.length);
    const slashIdx = rest.lastIndexOf('/');
    if (slashIdx >= 0) {
      bassLabel = rest.slice(slashIdx + 1);
      extension = rest.slice(0, slashIdx);
    } else {
      extension = rest;
    }
    qualifier = '';
  }

  let newName = newRoot + qualifier + extension;
  let newBass: string | undefined;
  if (bassLabel) {
    const bassParsed = parseNashvilleLabel(bassLabel);
    if (bassParsed) {
      const bassSt = (keySt + bassParsed.st) % 12;
      newBass = semitoneToRoot(bassSt, useFlats);
      newName += `/${newBass}`;
    }
  }

  const result: Chord = { ...chord, name: newName, root: newRoot };
  if (qualifier) result.qualifier = qualifier; else delete result.qualifier;
  if (extension) result.extension = extension; else delete result.extension;
  if (newBass !== undefined) result.bass = newBass; else delete result.bass;
  return result;
}

// ─── Song-level walk ──────────────────────────────────────────────────────────

function mapSongChords(song: Song, fn: (chord: Chord) => Chord): Song {
  return { ...song, lines: song.lines.map((l) => mapLine(l, fn)) };
}

function mapLine(line: Line, fn: (chord: Chord) => Chord): Line {
  switch (line.type) {
    case 'lyric': return mapLyric(line, fn);
    case 'section': return { ...line, lines: line.lines.map((l) => mapLine(l, fn)) };
    case 'grid_row': return mapGrid(line, fn);
    default: return line;
  }
}

function mapLyric(line: LyricLine, fn: (chord: Chord) => Chord): LyricLine {
  return { type: 'lyric', segments: line.segments.map((seg) => mapSegment(seg, fn)) };
}

function mapSegment(seg: Segment, fn: (chord: Chord) => Chord): Segment {
  return seg.chord !== undefined ? { ...seg, chord: fn(seg.chord) } : seg;
}

function mapGrid(row: GridRow, fn: (chord: Chord) => Chord): GridRow {
  return { type: 'grid_row', cells: row.cells.map((c) => ({ chords: c.chords.map(fn) })) };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert all chords in a song to Nashville Numbers relative to the given key.
 *
 * Each chord root is replaced by its scale degree (1–7). Chromatic roots use
 * a `b` prefix (flat of the next higher scale degree): F in G → b7, Bb in G → b3.
 * Qualifiers, extensions, and bass notes are preserved.
 *
 * @remarks Tier-2 auxiliary helper — not part of the ChordPro format.
 */
export function toNashville(song: Song, key: string): Song {
  const keyChord = parseChord(key, { mode: 'relaxed' });
  if (!keyChord.parsed || keyChord.root === undefined) return song;
  const keySt = SEMITONE[keyChord.root];
  if (keySt === undefined) return song;
  const degreeMap = buildDegreeMap(keySt);
  return mapSongChords(song, (c) => chordToNashville(c, degreeMap));
}

/**
 * Convert Nashville Number chords back to named chords in the given key.
 *
 * Accepts chord roots as produced by `toNashville` (e.g. `1`, `b7`, `#4`).
 * Also accepts songs where Nashville numbers were written directly in the
 * ChordPro source (e.g. `[1]word`, `[b7]two`).
 *
 * @remarks Tier-2 auxiliary helper — not part of the ChordPro format.
 */
export function fromNashville(song: Song, key: string): Song {
  const keyChord = parseChord(key, { mode: 'relaxed' });
  if (!keyChord.parsed || keyChord.root === undefined) return song;
  const keySt = SEMITONE[keyChord.root];
  if (keySt === undefined) return song;
  const useFlats = keyUsesFlats(keySt);
  return mapSongChords(song, (c) => chordFromNashville(c, keySt, useFlats));
}
