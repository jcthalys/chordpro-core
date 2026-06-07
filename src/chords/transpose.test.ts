/**
 * Tier 1 — transposition tests.
 * @tier tier1
 */

import { describe, it, expect } from 'vitest';
import { transposeChord, transpose } from './transpose.js';
import { parseChord } from './parseChord.js';
import { parse } from '../parser/parse.js';

function tc(name: string, n: number, opts = {}) {
  return transposeChord(parseChord(name), n, opts);
}

describe('transposeChord', () => {
  it('Am7 + 2 → Bm7', () => {
    expect(tc('Am7', 2).name).toBe('Bm7');
  });

  it('C/B + 2 → D/C# (sharps default)', () => {
    const r = tc('C/B', 2);
    expect(r.name).toBe('D/C#');
  });

  it('C/B + 2 → D/Db (flats)', () => {
    const r = tc('C/B', 2, { preferFlats: true });
    expect(r.name).toBe('D/Db');
  });

  it('+n then -n is identity', () => {
    const chords = ['C', 'Am7', 'F#dim7', 'Bbmaj7', 'Fmaj7/A'];
    for (const name of chords) {
      const parsed = parseChord(name);
      if (!parsed.parsed) continue;
      const up = transposeChord(parsed, 5);
      const back = transposeChord(up, -5);
      expect(back.root).toBe(parsed.root);
      expect(back.qualifier).toBe(parsed.qualifier);
      expect(back.extension).toBe(parsed.extension);
    }
  });

  it('preserves qualifier: Am7 → Bm7 (minor preserved)', () => {
    const r = tc('Am7', 2);
    expect(r.qualifier).toBe('m');
    expect(r.extension).toBe('7');
  });

  it('preserves extension: Dsus2 + 1 → Ebsus2', () => {
    const r = tc('Dsus2', 1, { preferFlats: true });
    expect(r.root).toBe('Eb');
    expect(r.extension).toBe('sus2');
  });

  it('passes through unparsed chord unchanged', () => {
    const chord = parseChord('Xyz', { mode: 'strict' });
    expect(chord.parsed).toBe(false);
    const r = transposeChord(chord, 5);
    expect(r.name).toBe('Xyz');
    expect(r.parsed).toBe(false);
  });

  it('passes through annotation chord unchanged', () => {
    // Annotations are handled at the segment level; this tests the chord path
    const chord = { name: 'Coda', parsed: false };
    const r = transposeChord(chord, 7);
    expect(r.name).toBe('Coda');
  });

  it('wraps correctly at octave boundary (B + 1 → C)', () => {
    expect(tc('B', 1).name).toBe('C');
  });

  it('C + 12 = C (octave identity)', () => {
    expect(tc('C', 12).name).toBe('C');
  });

  it('handles negative semitones', () => {
    expect(tc('D', -2).name).toBe('C');
  });
});

describe('transpose (song-level)', () => {
  it('transposes all chords in a song', () => {
    const src = '{title: Song}\n[C]Word [G]two\n[Am]three';
    const song = parse(src);
    const transposed = transpose(song, 2);
    const line = transposed.lines.find((l) => l.type === 'lyric');
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.chord?.name).toBe('D');
      expect(line.segments[1]?.chord?.name).toBe('A');
    }
  });

  it('does not mutate the original song', () => {
    const src = '[C]Word';
    const song = parse(src);
    transpose(song, 2);
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.chord?.name).toBe('C');
    }
  });

  it('leaves tab blocks untransposed', () => {
    const src = '{start_of_tab}\ne|--0--2--3--|\n{end_of_tab}';
    const song = parse(src);
    const transposed = transpose(song, 5);
    const section = transposed.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      const tabLine = section.lines[0];
      if (tabLine?.type === 'tab_line') {
        expect(tabLine.text).toContain('e|--0--2--3--|');
      }
    }
  });

  it('leaves annotations untransposed', () => {
    const src = '[*Coda]word';
    const song = parse(src);
    const transposed = transpose(song, 3);
    const line = transposed.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.annotation).toBe('Coda');
    }
  });
});
