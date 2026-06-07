/**
 * guessKey — Tier 2 auxiliary helper.
 * Frequency analysis of chord roots + major/minor heuristic.
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

/** Guess the key of a song from its chord content. */
export function guessKey(input: string | Song): KeyGuess | null {
  const song: Song = typeof input === 'string' ? parse(input) : input;

  const rootFreq = new Map<string, number>();
  collectChords(song.lines, rootFreq);

  if (rootFreq.size === 0) return null;

  // Sort by frequency
  const entries = [...rootFreq.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0);

  const [topRoot, topCount] = entries[0]!;
  if (topCount < 2) return null;

  const confidence = topCount / total;
  return { key: topRoot, confidence };
}

function collectChords(lines: Line[], freq: Map<string, number>): void {
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
            if (chord.parsed && chord.root) {
              freq.set(chord.root, (freq.get(chord.root) ?? 0) + 1);
            }
          }
        }
        break;
    }
  }
}

function collectFromLyric(line: LyricLine, freq: Map<string, number>): void {
  for (const seg of line.segments) {
    if (seg.chord?.parsed && seg.chord.root) {
      freq.set(seg.chord.root, (freq.get(seg.chord.root) ?? 0) + 1);
    }
  }
}
