/**
 * guessKey — Tier 2 auxiliary helper.
 * Diatonic-coverage scoring across all 24 major/minor keys.
 *
 * @remarks
 * Auxiliary helper, not part of the ChordPro format specification.
 */

import type { Song, Line, LyricLine } from '../model/types.js';
import { parse } from '../parser/parse.js';

export interface KeyGuess {
  key: string;
  confidence: number;
}

// Semitone lookup (handles enharmonic equivalents)
const ROOT_TO_ST: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  'C#': 1, Db: 1, 'D#': 3, Eb: 3, 'F#': 6, Gb: 6,
  'G#': 8, Ab: 8, 'A#': 10, Bb: 10, 'B#': 0, Cb: 11,
  H: 11, Bes: 10, Es: 3, As: 8,
};

// Major scale intervals (semitones from root)
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// Natural minor scale intervals
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// Preferred key name for each of the 24 keys (12 major + 12 minor)
// Index = root semitone (0-11), major names prefer sharps in sharp keys, flats in flat keys
const MAJOR_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm'];

// Weight multipliers for chord functions (I=tonic, V=dominant get extra weight)
const TONIC_BONUS = 1.5;
const DOMINANT_BONUS = 1.2;

/** Guess the key of a song from its chord content. */
export function guessKey(input: string | Song): KeyGuess | null {
  const song: Song = typeof input === 'string' ? parse(input) : input;

  // Collect semitone → {totalFreq, minorFreq} for every chord root
  const semFreq = new Map<number, { total: number; minor: number; qualifier: string }>();
  collectChords(song.lines, semFreq);
  if (semFreq.size === 0) return null;

  const totalChords = [...semFreq.values()].reduce((s, v) => s + v.total, 0);
  if (totalChords < 2) return null;

  let bestScore = -1;
  let bestKey = 'C';
  let bestConf = 0;

  for (let root = 0; root < 12; root++) {
    for (const isMinor of [false, true]) {
      const scale = isMinor ? MINOR : MAJOR;
      const diatonic = new Set(scale.map(i => (root + i) % 12));

      // Dominant semitone (V of the key)
      const dominant = (root + 7) % 12;
      // Leading scale degree (VII in major / bVII in minor)
      const leading = isMinor ? (root + 10) % 12 : (root + 11) % 12;

      let score = 0;
      for (const [st, { total }] of semFreq) {
        if (!diatonic.has(st)) continue;
        let w = total;
        if (st === root) w *= TONIC_BONUS;
        else if (st === dominant) w *= DOMINANT_BONUS;
        else if (st === leading) w *= 0.9; // leading tone slight discount
        score += w;
      }

      // Tiebreaker bonus: if most-frequent chord root matches tonic, prefer this key
      const tonicEntry = semFreq.get(root);
      if (tonicEntry) {
        const topFreq = Math.max(...[...semFreq.values()].map(v => v.total));
        if (tonicEntry.total === topFreq) score += 0.5;
      }

      // Minor quality preference: if minor-quality chords dominate at this root, prefer minor key
      if (isMinor && tonicEntry && tonicEntry.minor > tonicEntry.total * 0.4) score += 0.3;
      if (!isMinor && tonicEntry && tonicEntry.minor < tonicEntry.total * 0.3) score += 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestKey = isMinor ? (MINOR_NAMES[root] ?? 'Am') : (MAJOR_NAMES[root] ?? 'C');
        // Confidence = weighted diatonic coverage
        const diatonicTotal = [...semFreq.entries()]
          .filter(([st]) => diatonic.has(st))
          .reduce((s, [, v]) => s + v.total, 0);
        bestConf = diatonicTotal / totalChords;
      }
    }
  }

  return { key: bestKey, confidence: Math.min(bestConf, 1) };
}

// ─── Chord collection ─────────────────────────────────────────────────────────

type FreqMap = Map<number, { total: number; minor: number; qualifier: string }>;

function collectChords(lines: Line[], freq: FreqMap): void {
  for (const line of lines) {
    switch (line.type) {
      case 'lyric':
        collectFromLyric(line, freq);
        break;
      case 'section':
        if (!line.delegated) collectChords(line.lines, freq);
        break;
      case 'grid_row':
        for (const cell of line.cells) {
          for (const chord of cell.chords) {
            if (chord.parsed && chord.root) addRoot(chord.root, chord.qualifier, freq);
          }
        }
        break;
    }
  }
}

function collectFromLyric(line: LyricLine, freq: FreqMap): void {
  for (const seg of line.segments) {
    if (seg.chord?.parsed && seg.chord.root) {
      addRoot(seg.chord.root, seg.chord.qualifier, freq);
    }
  }
}

function addRoot(root: string, qualifier: string | undefined, freq: FreqMap): void {
  const st = ROOT_TO_ST[root];
  if (st === undefined) return;
  const isMinor = qualifier === 'm' || qualifier === 'mi' || qualifier === 'min' || qualifier === '-';
  const entry = freq.get(st) ?? { total: 0, minor: 0, qualifier: qualifier ?? '' };
  entry.total++;
  if (isMinor) entry.minor++;
  freq.set(st, entry);
}
