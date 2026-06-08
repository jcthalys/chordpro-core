/**
 * getChordShape — Tier 2 auxiliary helper.
 * Returns chord fingering data (no SVG, no drawing).
 *
 * Convention for frets arrays: values are 1-indexed slot positions
 * within the diagram window (1 = first slot = actual guitar fret `baseFret`).
 * 0 = open string, -1 = muted/not played.
 *
 * @remarks
 * Auxiliary helper, not part of the ChordPro format specification.
 */

import type { Song, ChordDef } from '../model/types.js';

export interface DiagramData {
  baseFret: number;
  /** Fret slot positions per string (0=open, -1=muted, 1=first slot=actual fret baseFret). */
  frets: number[];
  /** Optional finger numbers per string (0=no finger). */
  fingers?: number[];
}

type InstrumentTable = Record<string, DiagramData>;

// ─── Guitar seed table ────────────────────────────────────────────────────────
// String order: [low_E, A, D, G, B, high_E]
// Fret values: 0=open, -1=muted, 1..5 = diagram slot (1 = actual fret `baseFret`)

const GUITAR: InstrumentTable = {
  // ── Open major ──────────────────────────────────────────────────────────────
  C:     { baseFret: 1, frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  D:     { baseFret: 1, frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  E:     { baseFret: 1, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  F:     { baseFret: 1, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  G:     { baseFret: 1, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  A:     { baseFret: 1, frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  B:     { baseFret: 2, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  // Accidental major (barre shapes)
  'F#':  { baseFret: 2, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  Gb:    { baseFret: 2, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  Bb:    { baseFret: 1, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  'A#':  { baseFret: 1, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  Ab:    { baseFret: 4, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  'G#':  { baseFret: 4, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  Eb:    { baseFret: 3, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  'D#':  { baseFret: 3, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  Db:    { baseFret: 4, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },
  'C#':  { baseFret: 4, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },

  // ── Open minor ─────────────────────────────────────────────────────────────
  Cm:    { baseFret: 3, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  Dm:    { baseFret: 1, frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Em:    { baseFret: 1, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Fm:    { baseFret: 1, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  Gm:    { baseFret: 3, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  Am:    { baseFret: 1, frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Bm:    { baseFret: 2, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  // Accidental minor
  'F#m': { baseFret: 2, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  Gbm:   { baseFret: 2, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  Bbm:   { baseFret: 1, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  'A#m': { baseFret: 1, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  Abm:   { baseFret: 4, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  'G#m': { baseFret: 4, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
  Ebm:   { baseFret: 3, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  'D#m': { baseFret: 3, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  Dbm:   { baseFret: 4, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },
  'C#m': { baseFret: 4, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] },

  // ── Dominant 7th ───────────────────────────────────────────────────────────
  C7:    { baseFret: 1, frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  D7:    { baseFret: 1, frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  E7:    { baseFret: 1, frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  F7:    { baseFret: 1, frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1] },
  G7:    { baseFret: 1, frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  A7:    { baseFret: 1, frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  B7:    { baseFret: 1, frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Bb7:   { baseFret: 1, frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1] },
  Eb7:   { baseFret: 3, frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1] },
  'F#7': { baseFret: 2, frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1] },

  // ── Major 7th ──────────────────────────────────────────────────────────────
  Cmaj7:  { baseFret: 1, frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  Dmaj7:  { baseFret: 1, frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
  Emaj7:  { baseFret: 1, frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
  Fmaj7:  { baseFret: 1, frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  Gmaj7:  { baseFret: 1, frets: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3] },
  Amaj7:  { baseFret: 1, frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  Bbmaj7: { baseFret: 1, frets: [-1, 1, 3, 2, 3, 1], fingers: [0, 1, 3, 2, 4, 1] },
  Bmaj7:  { baseFret: 2, frets: [-1, 1, 3, 2, 3, 1], fingers: [0, 1, 3, 2, 4, 1] },

  // ── Minor 7th ──────────────────────────────────────────────────────────────
  Am7:   { baseFret: 1, frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Em7:   { baseFret: 1, frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  Dm7:   { baseFret: 1, frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 3, 1, 1] },
  Bm7:   { baseFret: 2, frets: [-1, 1, 3, 1, 2, 1], fingers: [0, 1, 3, 1, 2, 1] },
  Gm7:   { baseFret: 3, frets: [1, 3, 1, 1, 1, 1], fingers: [1, 3, 1, 1, 1, 1] },
  Cm7:   { baseFret: 3, frets: [-1, 1, 3, 1, 2, 1], fingers: [0, 1, 3, 1, 2, 1] },
  Fm7:   { baseFret: 1, frets: [1, 3, 1, 1, 1, 1], fingers: [1, 3, 1, 1, 1, 1] },
  'F#m7':{ baseFret: 2, frets: [1, 3, 1, 1, 1, 1], fingers: [1, 3, 1, 1, 1, 1] },
  'C#m7':{ baseFret: 4, frets: [-1, 1, 3, 1, 2, 1], fingers: [0, 1, 3, 1, 2, 1] },

  // ── Minor major 7th ────────────────────────────────────────────────────────
  Ammaj7: { baseFret: 1, frets: [-1, 0, 2, 1, 1, 0], fingers: [0, 0, 2, 1, 1, 0] },

  // ── Suspended ──────────────────────────────────────────────────────────────
  Asus2:  { baseFret: 1, frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 2, 3, 0, 0] },
  Asus4:  { baseFret: 1, frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Dsus2:  { baseFret: 1, frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  Dsus4:  { baseFret: 1, frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
  Esus4:  { baseFret: 1, frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
  Gsus4:  { baseFret: 1, frets: [3, -1, 0, 0, 1, 3], fingers: [2, 0, 0, 0, 1, 3] },
  Csus2:  { baseFret: 1, frets: [-1, 3, 0, 0, 1, 0], fingers: [0, 3, 0, 0, 1, 0] },
  Csus4:  { baseFret: 1, frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1] },
  Bsus4:  { baseFret: 2, frets: [-1, 1, 3, 3, 4, 1], fingers: [0, 1, 2, 3, 4, 1] },
  Bbsus4: { baseFret: 1, frets: [-1, 1, 3, 3, 4, 1], fingers: [0, 1, 2, 3, 4, 1] },
  Fsus4:  { baseFret: 1, frets: [1, 3, 3, 3, 1, 1], fingers: [1, 2, 3, 4, 1, 1] },

  // ── Add9 ───────────────────────────────────────────────────────────────────
  Cadd9:  { baseFret: 1, frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 3, 2, 0, 4, 0] },
  Gadd9:  { baseFret: 1, frets: [3, 2, 0, 2, 0, 3], fingers: [2, 1, 0, 3, 0, 4] },
  Dadd9:  { baseFret: 1, frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
  Aadd9:  { baseFret: 1, frets: [-1, 0, 2, 4, 2, 0], fingers: [0, 0, 1, 4, 2, 0] },
  Eadd9:  { baseFret: 1, frets: [0, 2, 2, 1, 0, 2], fingers: [0, 2, 3, 1, 0, 4] },

  // ── Dominant 9th ───────────────────────────────────────────────────────────
  G9:    { baseFret: 1, frets: [3, 2, 0, 2, 0, 1], fingers: [3, 2, 0, 4, 0, 1] },
  D9:    { baseFret: 1, frets: [-1, -1, 0, 2, 1, 0], fingers: [0, 0, 0, 2, 1, 0] },
  A9:    { baseFret: 1, frets: [-1, 0, 2, 0, 2, 2], fingers: [0, 0, 1, 0, 2, 3] },
  C9:    { baseFret: 3, frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1] },
  E9:    { baseFret: 1, frets: [0, 2, 0, 1, 3, 2], fingers: [0, 2, 0, 1, 4, 3] },

  // ── Minor 9th ──────────────────────────────────────────────────────────────
  Am9:   { baseFret: 1, frets: [-1, 0, 2, 0, 1, 3], fingers: [0, 0, 2, 0, 1, 4] },
  Em9:   { baseFret: 1, frets: [0, 2, 0, 0, 3, 0], fingers: [0, 2, 0, 0, 4, 0] },
  Dm9:   { baseFret: 1, frets: [-1, -1, 0, 2, 1, 0], fingers: [0, 0, 0, 2, 1, 0] },

  // ── Diminished ─────────────────────────────────────────────────────────────
  Bdim:   { baseFret: 1, frets: [-1, 2, 3, 4, 3, -1], fingers: [0, 1, 2, 4, 3, 0] },
  Edim:   { baseFret: 1, frets: [0, 1, 2, 3, 2, -1], fingers: [0, 1, 2, 4, 3, 0] },
  Adim:   { baseFret: 1, frets: [-1, 0, 1, 2, 1, -1], fingers: [0, 0, 1, 3, 2, 0] },
  Gdim:   { baseFret: 1, frets: [3, -1, 2, 3, 2, -1], fingers: [2, 0, 1, 3, 1, 0] },
  'F#dim':{ baseFret: 1, frets: [2, -1, 1, 2, 1, -1], fingers: [2, 0, 1, 3, 1, 0] },
  Cdim:   { baseFret: 3, frets: [-1, 1, 2, 3, 2, -1], fingers: [0, 1, 2, 4, 3, 0] },
  Ddim:   { baseFret: 1, frets: [-1, -1, 0, 1, 0, 1], fingers: [0, 0, 0, 1, 0, 2] },
  Bdim7:  { baseFret: 1, frets: [-1, 2, 3, 2, 3, -1], fingers: [0, 1, 3, 2, 4, 0] },
  'F#dim7':{ baseFret: 1, frets: [2, -1, 1, 2, 1, 2], fingers: [2, 0, 1, 3, 1, 4] },
  Adim7:  { baseFret: 1, frets: [-1, 0, 1, 2, 1, 2], fingers: [0, 0, 1, 3, 2, 4] },

  // ── Augmented ──────────────────────────────────────────────────────────────
  Caug:  { baseFret: 1, frets: [-1, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
  Daug:  { baseFret: 1, frets: [-1, -1, 0, 3, 3, 2], fingers: [0, 0, 0, 2, 3, 1] },
  Eaug:  { baseFret: 1, frets: [0, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
  Gaug:  { baseFret: 1, frets: [3, 2, 1, 0, 0, 3], fingers: [3, 2, 1, 0, 0, 4] },
  Aaug:  { baseFret: 1, frets: [-1, 0, 3, 2, 2, 1], fingers: [0, 0, 4, 2, 3, 1] },
  Faug:  { baseFret: 1, frets: [1, 0, 3, 2, 2, 1], fingers: [1, 0, 4, 2, 3, 1] },

  // ── 6th ────────────────────────────────────────────────────────────────────
  C6:    { baseFret: 1, frets: [-1, 3, 2, 2, 1, 0], fingers: [0, 4, 2, 3, 1, 0] },
  D6:    { baseFret: 1, frets: [-1, -1, 0, 2, 0, 2], fingers: [0, 0, 0, 1, 0, 2] },
  E6:    { baseFret: 1, frets: [0, 2, 2, 1, 2, 0], fingers: [0, 2, 3, 1, 4, 0] },
  G6:    { baseFret: 1, frets: [3, 2, 0, 0, 0, 0], fingers: [2, 1, 0, 0, 0, 0] },
  A6:    { baseFret: 1, frets: [-1, 0, 2, 2, 2, 2], fingers: [0, 0, 1, 2, 3, 4] },
  Am6:   { baseFret: 1, frets: [-1, 0, 2, 2, 1, 2], fingers: [0, 0, 2, 3, 1, 4] },

  // ── 6/9 ────────────────────────────────────────────────────────────────────
  'A6/9':  { baseFret: 1, frets: [-1, 0, 2, 2, 0, 2], fingers: [0, 0, 1, 2, 0, 3] },

  // ── Power chords ────────────────────────────────────────────────────────────
  C5:    { baseFret: 3, frets: [-1, 1, 3, 3, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
  D5:    { baseFret: 1, frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 3, 0] },
  E5:    { baseFret: 1, frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0] },
  G5:    { baseFret: 1, frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
  A5:    { baseFret: 1, frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0] },
};

// ─── Ukulele seed table ───────────────────────────────────────────────────────
// String order: [G, C, E, A] (standard ukulele GCEA tuning, low to high)

const UKULELE: InstrumentTable = {
  // ── Open major ──────────────────────────────────────────────────────────────
  C:    { baseFret: 1, frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3] },
  D:    { baseFret: 1, frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0] },
  E:    { baseFret: 1, frets: [4, 4, 4, 2], fingers: [2, 3, 4, 1] },
  F:    { baseFret: 1, frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0] },
  G:    { baseFret: 1, frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2] },
  A:    { baseFret: 1, frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0] },
  B:    { baseFret: 1, frets: [4, 3, 2, 2], fingers: [4, 3, 1, 2] },
  Bb:   { baseFret: 1, frets: [3, 2, 1, 1], fingers: [3, 2, 1, 1] },
  'A#': { baseFret: 1, frets: [3, 2, 1, 1], fingers: [3, 2, 1, 1] },
  Eb:   { baseFret: 1, frets: [0, 3, 3, 1], fingers: [0, 3, 4, 1] },
  'D#': { baseFret: 1, frets: [0, 3, 3, 1], fingers: [0, 3, 4, 1] },
  Ab:   { baseFret: 1, frets: [1, 3, 4, 3], fingers: [1, 2, 4, 3] },
  'G#': { baseFret: 1, frets: [1, 3, 4, 3], fingers: [1, 2, 4, 3] },
  Db:   { baseFret: 1, frets: [1, 1, 1, 4], fingers: [1, 1, 1, 4] },
  'C#': { baseFret: 1, frets: [1, 1, 1, 4], fingers: [1, 1, 1, 4] },
  'F#': { baseFret: 1, frets: [3, 1, 2, 1], fingers: [3, 1, 2, 1] },
  Gb:   { baseFret: 1, frets: [3, 1, 2, 1], fingers: [3, 1, 2, 1] },

  // ── Minor ───────────────────────────────────────────────────────────────────
  Cm:   { baseFret: 3, frets: [0, 3, 3, 3], fingers: [0, 1, 2, 3] },
  Dm:   { baseFret: 1, frets: [2, 2, 1, 0], fingers: [2, 3, 1, 0] },
  Em:   { baseFret: 1, frets: [0, 4, 3, 2], fingers: [0, 3, 2, 1] },
  Fm:   { baseFret: 1, frets: [1, 0, 1, 3], fingers: [1, 0, 2, 4] },
  Gm:   { baseFret: 1, frets: [0, 2, 3, 1], fingers: [0, 2, 3, 1] },
  Am:   { baseFret: 1, frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0] },
  Bm:   { baseFret: 1, frets: [4, 2, 2, 2], fingers: [4, 1, 2, 3] },
  Bbm:  { baseFret: 1, frets: [3, 1, 1, 1], fingers: [3, 1, 1, 1] },
  Ebm:  { baseFret: 3, frets: [1, 3, 3, 2], fingers: [1, 3, 4, 2] },
  'F#m':{ baseFret: 1, frets: [2, 1, 2, 0], fingers: [2, 1, 3, 0] },
  'C#m':{ baseFret: 1, frets: [1, 1, 0, 4], fingers: [1, 1, 0, 4] },
  Abm:  { baseFret: 1, frets: [1, 3, 4, 2], fingers: [1, 3, 4, 2] },

  // ── Dominant 7th ───────────────────────────────────────────────────────────
  C7:   { baseFret: 1, frets: [0, 0, 0, 1], fingers: [0, 0, 0, 1] },
  D7:   { baseFret: 1, frets: [2, 2, 2, 3], fingers: [1, 2, 3, 4] },
  E7:   { baseFret: 1, frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3] },
  F7:   { baseFret: 1, frets: [2, 3, 1, 0], fingers: [2, 4, 1, 0] },
  G7:   { baseFret: 1, frets: [0, 2, 1, 2], fingers: [0, 3, 1, 2] },
  A7:   { baseFret: 1, frets: [0, 1, 0, 0], fingers: [0, 1, 0, 0] },
  B7:   { baseFret: 1, frets: [2, 3, 2, 2], fingers: [1, 4, 2, 3] },
  Bb7:  { baseFret: 1, frets: [1, 2, 1, 1], fingers: [1, 3, 1, 1] },

  // ── Major 7th ──────────────────────────────────────────────────────────────
  Cmaj7:  { baseFret: 1, frets: [0, 0, 0, 2], fingers: [0, 0, 0, 2] },
  Dmaj7:  { baseFret: 1, frets: [2, 2, 2, 4], fingers: [1, 2, 3, 4] },
  Fmaj7:  { baseFret: 1, frets: [2, 4, 1, 0], fingers: [2, 4, 1, 0] },
  Gmaj7:  { baseFret: 1, frets: [0, 2, 2, 2], fingers: [0, 1, 2, 3] },
  Amaj7:  { baseFret: 1, frets: [1, 1, 0, 0], fingers: [1, 2, 0, 0] },
  Bbmaj7: { baseFret: 1, frets: [3, 2, 1, 0], fingers: [4, 3, 2, 0] },

  // ── Minor 7th ──────────────────────────────────────────────────────────────
  Am7:  { baseFret: 1, frets: [0, 0, 0, 0], fingers: [0, 0, 0, 0] },
  Em7:  { baseFret: 1, frets: [0, 2, 0, 2], fingers: [0, 2, 0, 3] },
  Dm7:  { baseFret: 1, frets: [2, 2, 1, 3], fingers: [2, 3, 1, 4] },
  Bm7:  { baseFret: 1, frets: [2, 2, 2, 2], fingers: [1, 2, 3, 4] },
  Gm7:  { baseFret: 1, frets: [0, 2, 1, 1], fingers: [0, 3, 1, 2] },
  Cm7:  { baseFret: 3, frets: [3, 3, 3, 3], fingers: [1, 2, 3, 4] },
  'F#m7':{ baseFret: 1, frets: [2, 4, 2, 0], fingers: [1, 4, 2, 0] },

  // ── Suspended ──────────────────────────────────────────────────────────────
  Asus2:  { baseFret: 1, frets: [2, 4, 2, 0], fingers: [1, 3, 2, 0] },
  Asus4:  { baseFret: 1, frets: [2, 2, 3, 0], fingers: [1, 2, 3, 0] },
  Dsus2:  { baseFret: 1, frets: [2, 2, 0, 0], fingers: [1, 2, 0, 0] },
  Dsus4:  { baseFret: 1, frets: [0, 2, 3, 0], fingers: [0, 1, 2, 0] },
  Esus4:  { baseFret: 1, frets: [2, 4, 4, 2], fingers: [1, 3, 4, 2] },
  Gsus4:  { baseFret: 1, frets: [0, 2, 3, 3], fingers: [0, 1, 2, 3] },

  // ── Diminished ─────────────────────────────────────────────────────────────
  Bdim:   { baseFret: 1, frets: [3, 1, 3, 1], fingers: [3, 1, 4, 2] },
  Gdim:   { baseFret: 1, frets: [0, 1, 0, 1], fingers: [0, 1, 0, 2] },
  Adim:   { baseFret: 1, frets: [2, 3, 2, 3], fingers: [1, 3, 2, 4] },
  Fdim:   { baseFret: 1, frets: [1, 2, 1, 2], fingers: [1, 3, 2, 4] },

  // ── Augmented ──────────────────────────────────────────────────────────────
  Caug:   { baseFret: 1, frets: [0, 1, 1, 0], fingers: [0, 1, 2, 0] },
  Eaug:   { baseFret: 1, frets: [1, 0, 0, 3], fingers: [1, 0, 0, 4] },
  Gaug:   { baseFret: 1, frets: [0, 3, 3, 2], fingers: [0, 3, 4, 1] },
  Aaug:   { baseFret: 1, frets: [2, 1, 1, 0], fingers: [3, 1, 2, 0] },

  // ── Add9 ───────────────────────────────────────────────────────────────────
  Cadd9:  { baseFret: 1, frets: [0, 2, 0, 3], fingers: [0, 1, 0, 2] },
  Gadd9:  { baseFret: 1, frets: [0, 2, 0, 2], fingers: [0, 1, 0, 2] },
  Dadd9:  { baseFret: 1, frets: [2, 4, 2, 0], fingers: [1, 3, 2, 0] },
  Fadd9:  { baseFret: 1, frets: [2, 0, 1, 3], fingers: [2, 0, 1, 3] },
};

// ─── Algorithmic barre chord fallback ────────────────────────────────────────
// Derives major/minor guitar shapes from moveable E-shape / A-shape barre patterns.
// Used only when the chord is not found in the static table.

const ROOT_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  'C#': 1, Db: 1, 'D#': 3, Eb: 3, 'F#': 6, Gb: 6,
  'G#': 8, Ab: 8, 'A#': 10, Bb: 10,
};

/** Attempt to derive a guitar barre chord shape algorithmically. */
function barreShape(chordName: string): DiagramData | null {
  // Parse root and quality
  const m = chordName.match(/^([A-G][b#]?)(m(?:in|i)?|-)?$/);
  if (!m) return null;
  const rootStr = m[1]!;
  const isMinor = Boolean(m[2]);
  const rootSt = ROOT_SEMITONE[rootStr];
  if (rootSt === undefined) return null;

  // E-string (semitone 4) — E-shape barre: root on string 6
  const eBase = ((rootSt - 4 + 12) % 12) || 12;
  // A-string (semitone 9) — A-shape barre: root on string 5
  const aBase = ((rootSt - 9 + 12) % 12) || 12;

  // Prefer the lower-position barre (≤ 7), fall back to the other
  const useE = eBase <= 7 && (aBase > 7 || eBase <= aBase);
  const useA = !useE && aBase <= 9;
  if (!useE && !useA) return null;

  if (useE) {
    return isMinor
      ? { baseFret: eBase, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] }
      : { baseFret: eBase, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] };
  } else {
    return isMinor
      ? { baseFret: aBase, frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1] }
      : { baseFret: aBase, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up fingering data for a chord by name and instrument. */
export function getChordShape(
  name: string,
  instrument: 'guitar' | 'ukulele',
  song?: Song,
): DiagramData | null {
  // Song-defined chords have highest priority
  if (song) {
    const defined = getSongDefinedShape(name, song);
    if (defined) return defined;
  }

  const table = instrument === 'guitar' ? GUITAR : UKULELE;
  const fromTable = table[name];
  if (fromTable) return fromTable;

  // Algorithmic barre fallback (guitar only)
  if (instrument === 'guitar') return barreShape(name);

  return null;
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
