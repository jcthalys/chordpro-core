/**
 * Tier 2 — analysis (guessKey, getChordShape, Nashville) tests.
 * @tier tier2
 */

import { describe, it, expect } from 'vitest';
import { guessKey } from './guessKey.js';
import { getChordShape } from './chordShapes.js';
import { toNashville, fromNashville } from '../chords/nashville.js';
import { parse } from '../parser/parse.js';

describe('guessKey — diatonic coverage scoring', () => {
  it('returns null when no chords', () => {
    expect(guessKey('no chords here')).toBeNull();
  });

  it('returns null when fewer than 2 total chord occurrences', () => {
    expect(guessKey('[C]only')).toBeNull();
  });

  it('accepts a Song object', () => {
    const song = parse('[G]word [G]two [D]three');
    expect(guessKey(song)).not.toBeNull();
  });

  it('confidence is between 0 and 1', () => {
    const result = guessKey('[G]one [G]two [D]three [C]four');
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  // ── Major key detection ───────────────────────────────────────────────────

  it('detects G major (I-V-vi-IV)', () => {
    // G D Em C — classic I-V-vi-IV in G
    expect(guessKey('[G]a [D]b [Em]c [C]d [G]e [D]f [G]g')?.key).toBe('G');
  });

  it('detects C major', () => {
    expect(guessKey('[C]a [G]b [Am]c [F]d [C]e [Em]f [C]g')?.key).toBe('C');
  });

  it('detects D major', () => {
    expect(guessKey('[D]a [A]b [Bm]c [G]d [D]e [A]f [D]g')?.key).toBe('D');
  });

  it('detects A major', () => {
    expect(guessKey('[A]a [E]b [F#m]c [D]d [A]e [E]f [A]g')?.key).toBe('A');
  });

  it('detects E major', () => {
    expect(guessKey('[E]a [B]b [C#m]c [A]d [E]e [B]f [E]g')?.key).toBe('E');
  });

  it('detects F major', () => {
    expect(guessKey('[F]a [C]b [Dm]c [Bb]d [F]e [C]f [F]g')?.key).toBe('F');
  });

  it('detects Bb major', () => {
    expect(guessKey('[Bb]a [F]b [Gm]c [Eb]d [Bb]e [F]f [Bb]g')?.key).toBe('Bb');
  });

  // ── Minor key detection ───────────────────────────────────────────────────

  it('detects Am (i-VII-VI-VII pattern)', () => {
    // Am G F G Am — classic Am progression
    expect(guessKey('[Am]a [G]b [F]c [G]d [Am]e [Em]f [Am]g')?.key).toBe('Am');
  });

  it('detects Em', () => {
    expect(guessKey('[Em]a [D]b [C]c [D]d [Em]e [Am]f [Em]g')?.key).toBe('Em');
  });

  it('detects Dm', () => {
    expect(guessKey('[Dm]a [C]b [Bb]c [C]d [Dm]e [Dm]f [Gm]g')?.key).toBe('Dm');
  });

  it('distinguishes G major from Em (relative minor) by tonic frequency', () => {
    // Song clearly tonic on G, not Em
    const src = '[G]a [G]b [D]c [C]d [G]e [Em]f [G]g [D]h [G]i';
    expect(guessKey(src)?.key).toBe('G');
  });

  it('distinguishes Am from C major when minor tonic dominates', () => {
    const src = '[Am]a [Am]b [G]c [F]d [Am]e [Em]f [Am]g';
    expect(guessKey(src)?.key).toBe('Am');
  });

  it('returns high confidence for fully diatonic song', () => {
    // All chords diatonic to G major
    const result = guessKey('[G]a [D]b [Em]c [C]d [G]e [Am]f [Bm]g [G]h');
    expect(result!.confidence).toBeGreaterThan(0.85);
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
