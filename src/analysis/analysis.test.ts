/**
 * Tier 2 — analysis (guessKey, getChordShape, Nashville stubs) tests.
 * @tier tier2
 */

import { describe, it, expect } from 'vitest';
import { guessKey } from './guessKey.js';
import { getChordShape } from './chordShapes.js';
import { toNashville, fromNashville } from '../chords/nashville.js';
import { parse } from '../parser/parse.js';

describe('guessKey', () => {
  it('detects key G from G-heavy song', () => {
    const src = '[G]word [D]two [Em]three [C]four [G]five [D]six [G]seven';
    const result = guessKey(src);
    expect(result).not.toBeNull();
    expect(result?.key).toBe('G');
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('returns null when no chords', () => {
    expect(guessKey('no chords here')).toBeNull();
  });

  it('returns null when most-frequent root appears fewer than 2 times', () => {
    // Each chord appears once
    const src = '[C]one [D]two [E]three [F]four';
    const result = guessKey(src);
    // C appears once — should be null
    expect(result).toBeNull();
  });

  it('accepts a Song object', () => {
    const song = parse('[G]word [G]two [D]three');
    const result = guessKey(song);
    expect(result).not.toBeNull();
  });

  it('confidence is between 0 and 1', () => {
    const src = '[G]one [G]two [D]three';
    const result = guessKey(src);
    if (result) {
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('getChordShape', () => {
  it('returns shape for common guitar chords', () => {
    const chords = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Am', 'Em', 'Dm'];
    for (const name of chords) {
      const shape = getChordShape(name, 'guitar');
      expect(shape).not.toBeNull();
      expect(shape?.frets).toBeInstanceOf(Array);
      expect(shape?.baseFret).toBeGreaterThan(0);
    }
  });

  it('returns shape for common ukulele chords', () => {
    const chords = ['C', 'D', 'G', 'Am', 'F'];
    for (const name of chords) {
      const shape = getChordShape(name, 'ukulele');
      expect(shape).not.toBeNull();
    }
  });

  it('returns null for unknown chord', () => {
    expect(getChordShape('Xyz123', 'guitar')).toBeNull();
    expect(getChordShape('Xyz123', 'ukulele')).toBeNull();
  });

  it('returns defined chord from {define} directive', () => {
    const src = '{define: MyChord base-fret 1 frets 0 2 2 1 0 0}';
    const song = parse(src);
    const shape = getChordShape('MyChord', 'guitar', song);
    expect(shape).not.toBeNull();
    expect(shape?.baseFret).toBe(1);
    expect(shape?.frets).toEqual([0, 2, 2, 1, 0, 0]);
  });

  it('guitar frets array has 6 elements for standard chords', () => {
    const shape = getChordShape('G', 'guitar');
    expect(shape?.frets).toHaveLength(6);
  });

  it('ukulele frets array has 4 elements for standard chords', () => {
    const shape = getChordShape('G', 'ukulele');
    expect(shape?.frets).toHaveLength(4);
  });
});

describe('Nashville (stubs)', () => {
  it('toNashville returns a song (stub passthrough)', () => {
    const song = parse('[G]word [D]two');
    const result = toNashville(song, 'G');
    expect(result).toBeDefined();
    expect(result.lines).toEqual(song.lines);
  });

  it('fromNashville returns a song (stub passthrough)', () => {
    const song = parse('[1]word [5]two');
    const result = fromNashville(song, 'G');
    expect(result).toBeDefined();
  });
});
