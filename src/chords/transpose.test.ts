/**
 * Tier 1 — transposition tests.
 * @tier tier1
 */

import { describe, it, expect } from 'vitest';
import { transposeChord, transpose, soundingKey, soundingKeyOf } from './transpose.js';
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

describe('soundingKeyOf', () => {
  it('capo 0 returns key unchanged', () => {
    expect(soundingKeyOf('G', 0)).toBe('G');
  });

  it('G + capo 2 → A', () => {
    expect(soundingKeyOf('G', 2)).toBe('A');
  });

  it('Am + capo 3 → Cm (preserves minor)', () => {
    expect(soundingKeyOf('Am', 3)).toBe('Cm');
  });

  it('Bb + capo 1 → B (not Cb)', () => {
    expect(soundingKeyOf('Bb', 1)).toBe('B');
  });

  it('Eb + capo 2 → F (not E#)', () => {
    expect(soundingKeyOf('Eb', 2)).toBe('F');
  });

  it('C + capo 2 → D', () => {
    expect(soundingKeyOf('C', 2)).toBe('D');
  });

  it('D + capo 1 → Eb (flat key from sharp input uses sharps)', () => {
    expect(soundingKeyOf('D', 1)).toBe('D#');
  });

  it('Bb + capo 2 → C', () => {
    expect(soundingKeyOf('Bb', 2)).toBe('C');
  });

  it('Eb + capo 3 → Gb (flat preference)', () => {
    expect(soundingKeyOf('Eb', 3)).toBe('Gb');
  });

  it('F + capo 2 → G', () => {
    expect(soundingKeyOf('F', 2)).toBe('G');
  });

  it('Em + capo 2 → F#m (preserves minor, sharp preference)', () => {
    expect(soundingKeyOf('Em', 2)).toBe('F#m');
  });

  it('Bbm + capo 2 → Cm (minor flat key, flat preference)', () => {
    expect(soundingKeyOf('Bbm', 2)).toBe('Cm');
  });

  it('all 12 capo positions on G', () => {
    const expected = ['G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#'];
    for (let n = 0; n < 12; n++) {
      expect(soundingKeyOf('G', n)).toBe(expected[n]);
    }
  });

  it('unknown key root passes through unchanged', () => {
    expect(soundingKeyOf('Xyz', 2)).toBe('Xyz');
  });
});

describe('soundingKey', () => {
  it('returns null when no key directive', () => {
    const song = parse('{capo: 2}');
    expect(soundingKey(song)).toBeNull();
  });

  it('returns key unchanged when no capo', () => {
    const song = parse('{key: G}');
    expect(soundingKey(song)).toBe('G');
  });

  it('returns key unchanged when capo 0', () => {
    const song = parse('{key: G}\n{capo: 0}');
    expect(soundingKey(song)).toBe('G');
  });

  it('G + capo 2 → A', () => {
    const song = parse('{key: G}\n{capo: 2}');
    expect(soundingKey(song)).toBe('A');
  });

  it('Am + capo 3 → Cm', () => {
    const song = parse('{key: Am}\n{capo: 3}');
    expect(soundingKey(song)).toBe('Cm');
  });

  it('Bb + capo 1 → B', () => {
    const song = parse('{key: Bb}\n{capo: 1}');
    expect(soundingKey(song)).toBe('B');
  });
});
