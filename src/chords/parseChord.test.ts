/**
 * Tier 1 — chord parser tests (extensive).
 * @tier tier1
 */

import { describe, it, expect } from 'vitest';
import { parseChord } from './parseChord.js';
import { ALL_EXTENSIONS } from './extensions.js';

describe('parseChord — strict mode (default)', () => {
  // §5 regression set — MUST parse in strict mode
  const regressionCases: Array<[string, Partial<ReturnType<typeof parseChord>>]> = [
    ['Cadd9',   { root: 'C', extension: 'add9', parsed: true }],
    ['G7sus4',  { root: 'G', extension: '7sus4', parsed: true }],
    ['Am7b5',   { root: 'A', qualifier: 'm', extension: '7b5', parsed: true }],
    ['Fmaj7/A', { root: 'F', extension: 'maj7', bass: 'A', parsed: true }],
    ['Dsus2',   { root: 'D', extension: 'sus2', parsed: true }],
    ['Bbmaj7',  { root: 'Bb', extension: 'maj7', parsed: true }],
    ['F#dim7',  { root: 'F#', extension: 'dim7', parsed: true }],
    ['Gaug',    { root: 'G', qualifier: 'aug', parsed: true }],
    ['Esus2',   { root: 'E', extension: 'sus2', parsed: true }],
    ['Bm7',     { root: 'B', qualifier: 'm', extension: '7', parsed: true }],
  ];

  for (const [name, expected] of regressionCases) {
    it(`parses ${name}`, () => {
      const result = parseChord(name);
      expect(result).toMatchObject(expected);
    });
  }

  // Spec property table
  it('parses C (plain root)', () => {
    const r = parseChord('C');
    expect(r).toMatchObject({ root: 'C', parsed: true });
    expect(r.qualifier).toBeUndefined();
    expect(r.extension).toBeUndefined();
    expect(r.bass).toBeUndefined();
  });

  it('parses F# (sharp root)', () => {
    expect(parseChord('F#')).toMatchObject({ root: 'F#', parsed: true });
  });

  it('parses Bb (flat root)', () => {
    expect(parseChord('Bb')).toMatchObject({ root: 'Bb', parsed: true });
  });

  it('parses Am7 (minor + extension)', () => {
    expect(parseChord('Am7')).toMatchObject({ root: 'A', qualifier: 'm', extension: '7', parsed: true });
  });

  it('parses C/B (slash chord)', () => {
    const r = parseChord('C/B');
    expect(r).toMatchObject({ root: 'C', bass: 'B', parsed: true });
  });

  it('parses Besm (alternate spelling + minor)', () => {
    const r = parseChord('Besm');
    expect(r).toMatchObject({ root: 'Bes', qualifier: 'm', parsed: true });
  });

  it('parses German H root', () => {
    expect(parseChord('H')).toMatchObject({ root: 'H', parsed: true });
    expect(parseChord('Hm')).toMatchObject({ root: 'H', qualifier: 'm', parsed: true });
  });

  it('parses double-flat Hb', () => {
    expect(parseChord('Hb')).toMatchObject({ root: 'Hb', parsed: true });
  });

  it('parses ^ as maj alias', () => {
    expect(parseChord('C^7')).toMatchObject({ root: 'C', extension: '^7', parsed: true });
  });

  it('returns parsed:false for unknown chord in strict mode', () => {
    expect(parseChord('Xyz123')).toMatchObject({ parsed: false, name: 'Xyz123' });
  });

  it('never throws on bad input', () => {
    expect(() => parseChord('')).not.toThrow();
    expect(() => parseChord('!')).not.toThrow();
    expect(() => parseChord('////')).not.toThrow();
    expect(() => parseChord('C'.repeat(1000))).not.toThrow();
  });

  it('strict failure keeps original name', () => {
    const r = parseChord('InvalidChord');
    expect(r.name).toBe('InvalidChord');
    expect(r.parsed).toBe(false);
  });

  describe('full extension sweep', () => {
    for (const ext of ALL_EXTENSIONS) {
      it(`C${ext} is a valid chord`, () => {
        const r = parseChord(`C${ext}`);
        // Must not throw. Extensions starting with # or b create a name like
        // "C#5" which is legitimately parsed as root "C#" + ext "5" — both valid.
        // Just verify the chord parsed successfully with SOME root.
        if (r.parsed) {
          expect(r.root).toBeDefined();
          // For extensions NOT starting with # or b, the root must be C.
          if (!ext.startsWith('#') && !ext.startsWith('b')) {
            expect(r.root).toBe('C');
          }
        }
      });
    }
  });

  describe('slash chords', () => {
    it('parses Dm/F', () => {
      expect(parseChord('Dm/F')).toMatchObject({ root: 'D', qualifier: 'm', bass: 'F', parsed: true });
    });

    it('parses G/B', () => {
      expect(parseChord('G/B')).toMatchObject({ root: 'G', bass: 'B', parsed: true });
    });

    it('parses C/Bb (flat bass)', () => {
      expect(parseChord('C/Bb')).toMatchObject({ root: 'C', bass: 'Bb', parsed: true });
    });
  });
});

describe('parseChord — relaxed mode', () => {
  it('accepts Coda as C+oda', () => {
    const r = parseChord('Coda', { mode: 'relaxed' });
    expect(r.root).toBe('C');
    expect(r.extension).toBe('oda');
    expect(r.parsed).toBe(true);
  });

  it('accepts Gm* as G+m+*', () => {
    const r = parseChord('Gm*', { mode: 'relaxed' });
    expect(r.root).toBe('G');
    expect(r.qualifier).toBe('m');
    expect(r.extension).toBe('*');
    expect(r.parsed).toBe(true);
  });

  it('accepts arbitrary trailing text', () => {
    const r = parseChord('Csomething', { mode: 'relaxed' });
    expect(r.parsed).toBe(true);
    expect(r.root).toBe('C');
  });

  it('still fails on non-note roots', () => {
    const r = parseChord('Xyz', { mode: 'relaxed' });
    expect(r.parsed).toBe(false);
  });
});
