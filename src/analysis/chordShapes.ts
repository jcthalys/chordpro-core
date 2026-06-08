/**
 * getChordShape — Tier 2 auxiliary helper.
 * Returns chord fingering data (no SVG, no drawing).
 *
 * @remarks
 * Auxiliary helper, not part of the ChordPro format specification.
 */

import type { Song, ChordDef } from '../model/types.js';

export interface DiagramData {
  baseFret: number;
  /** Fret numbers per string (0=open, -1=muted). */
  frets: number[];
  /** Optional finger numbers per string (0=no finger). */
  fingers?: number[];
}

type InstrumentTable = Record<string, DiagramData>;

// ─── Built-in seed tables ─────────────────────────────────────────────────────

const GUITAR_SHAPES: InstrumentTable = {
  C:      { baseFret: 1, frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  Cm:     { baseFret: 3, frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1] },
  D:      { baseFret: 1, frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Dm:     { baseFret: 1, frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  E:      { baseFret: 1, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  Em:     { baseFret: 1, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  F:      { baseFret: 1, frets: [1, 1, 2, 3, 3, 1], fingers: [1, 1, 2, 3, 4, 1] },
  Fm:     { baseFret: 1, frets: [1, 1, 1, 3, 3, 1], fingers: [1, 1, 1, 3, 4, 1] },
  G:      { baseFret: 1, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  Gm:     { baseFret: 3, frets: [1, 1, 1, 3, 3, 1], fingers: [1, 1, 1, 3, 4, 1] },
  A:      { baseFret: 1, frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Am:     { baseFret: 1, frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  B:      { baseFret: 2, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  Bm:     { baseFret: 2, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  // Common 7ths
  G7:     { baseFret: 1, frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  D7:     { baseFret: 1, frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  A7:     { baseFret: 1, frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  E7:     { baseFret: 1, frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  Am7:    { baseFret: 1, frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Dm7:    { baseFret: 1, frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 3, 1, 1] },
  Fmaj7:  { baseFret: 1, frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  Cmaj7:  { baseFret: 1, frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
};

const UKULELE_SHAPES: InstrumentTable = {
  C:    { baseFret: 1, frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3] },
  Cm:   { baseFret: 3, frets: [0, 3, 3, 3], fingers: [0, 1, 2, 3] },
  D:    { baseFret: 1, frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0] },
  Dm:   { baseFret: 1, frets: [2, 2, 1, 0], fingers: [2, 3, 1, 0] },
  E:    { baseFret: 1, frets: [4, 4, 4, 2], fingers: [2, 3, 4, 1] },
  Em:   { baseFret: 1, frets: [0, 4, 3, 2], fingers: [0, 3, 2, 1] },
  F:    { baseFret: 1, frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0] },
  Fm:   { baseFret: 1, frets: [1, 0, 1, 3], fingers: [1, 0, 2, 4] },
  G:    { baseFret: 1, frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2] },
  Gm:   { baseFret: 1, frets: [0, 2, 3, 1], fingers: [0, 2, 3, 1] },
  A:    { baseFret: 1, frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0] },
  Am:   { baseFret: 1, frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0] },
  B:    { baseFret: 1, frets: [4, 3, 2, 2], fingers: [4, 3, 1, 2] },
  Bm:   { baseFret: 1, frets: [4, 2, 2, 2], fingers: [4, 1, 2, 3] },
  // Common 7ths
  G7:   { baseFret: 1, frets: [0, 2, 1, 2], fingers: [0, 3, 1, 2] },
  D7:   { baseFret: 1, frets: [2, 2, 2, 3], fingers: [1, 2, 3, 4] },
  A7:   { baseFret: 1, frets: [0, 1, 0, 0], fingers: [0, 1, 0, 0] },
  Am7:  { baseFret: 1, frets: [0, 0, 0, 0], fingers: [0, 0, 0, 0] },
  C7:   { baseFret: 1, frets: [0, 0, 0, 1], fingers: [0, 0, 0, 1] },
  F7:   { baseFret: 1, frets: [2, 3, 1, 0], fingers: [2, 4, 1, 0] },
};

/** Look up fingering data for a chord by name and instrument. */
export function getChordShape(
  name: string,
  instrument: 'guitar' | 'ukulele',
  song?: Song,
): DiagramData | null {
  // Check song-defined chords first
  if (song) {
    const defined = getSongDefinedShape(name, song);
    if (defined) return defined;
  }

  const table = instrument === 'guitar' ? GUITAR_SHAPES : UKULELE_SHAPES;
  return table[name] ?? null;
}

function getSongDefinedShape(name: string, song: Song): DiagramData | null {
  for (const line of song.lines) {
    if (line.type !== 'chord_def' || line.name !== name) continue;
    return chordDefToShape(line);
  }
  return null;
}

function chordDefToShape(def: ChordDef): DiagramData | null {
  if (!def.frets || def.frets.length === 0) return null;
  const shape: DiagramData = { baseFret: def.baseFret ?? 1, frets: def.frets };
  if (def.fingers && def.fingers.length > 0) shape.fingers = def.fingers;
  return shape;
}
