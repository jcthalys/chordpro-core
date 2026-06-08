/**
 * Tier 2 — analysis (guessKey, getChordShape, Nashville) tests.
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

describe('Nashville Number System', () => {
  // In key of G: G=1 A=2 B=3 C=4 D=5 E=6 F#=7
  describe('toNashville', () => {
    it('converts root to scale degree in key of G', () => {
      const song = parse('[G]word');
      const result = toNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('1');
    });

    it('converts the 5th degree (D in G)', () => {
      const song = parse('[D]word');
      const result = toNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('5');
    });

    it('preserves qualifier (minor)', () => {
      const song = parse('[Em]word');
      const result = toNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('6m');
    });

    it('preserves extension (Am7 in C → 6m7)', () => {
      const song = parse('[Am7]word');
      const result = toNashville(song, 'C');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('6m7');
    });

    it('handles chromatic root (C# in G = b5, flat of the 5th degree D)', () => {
      const song = parse('[C#]word');
      const result = toNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('b5');
    });

    it('handles flat 7 (F in G = b7)', () => {
      const song = parse('[F]word');
      const result = toNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('b7');
    });

    it('converts slash chord bass note', () => {
      const song = parse('[G/B]word');
      const result = toNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('1/3');
    });
  });

  describe('fromNashville', () => {
    it('converts degree to root in key of G', () => {
      const song = parse('[1]word');
      const result = fromNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('G');
    });

    it('converts 5 to D in key of G', () => {
      const song = parse('[5]word');
      const result = fromNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('D');
    });

    it('preserves qualifier', () => {
      const song = parse('[6m]word');
      const result = fromNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('Em');
    });

    it('handles flat degrees (b7 in G = F)', () => {
      const song = parse('[b7]word');
      const result = fromNashville(song, 'G');
      const lyric = result.lines.find((l) => l.type === 'lyric');
      expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('F');
    });
  });

  describe('round-trip', () => {
    it('fromNashville(toNashville(song, key), key) restores original chord names', () => {
      const chords = ['G', 'D', 'Em', 'C', 'Am7', 'Bm'];
      const src = chords.map((c) => `[${c}]word`).join('\n');
      const song = parse(src);
      const restored = fromNashville(toNashville(song, 'G'), 'G');
      const restoredChords = restored.lines
        .filter((l) => l.type === 'lyric')
        .map((l) => l.type === 'lyric' ? l.segments[0]?.chord?.name : undefined);
      expect(restoredChords).toEqual(chords);
    });

    it('round-trip in key of C', () => {
      const src = '[C]one [F]two [G]three [Am]four';
      const song = parse(src);
      const restored = fromNashville(toNashville(song, 'C'), 'C');
      const names = restored.lines
        .filter((l) => l.type === 'lyric')
        .flatMap((l) => l.type === 'lyric' ? l.segments.filter((s) => s.chord).map((s) => s.chord!.name) : []);
      expect(names).toEqual(['C', 'F', 'G', 'Am']);
    });
  });
});
