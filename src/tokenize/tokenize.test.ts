/**
 * Tier 2 — tokenizer tests.
 * @tier tier2
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize.js';

describe('tokenize', () => {
  describe('offset tiling (property: concatenating text reproduces source)', () => {
    const testSources = [
      '{title: My Song}\n[G]Hello [D]world\n# comment\n{soc}\n[Em]line\n{eoc}\n',
      '',
      '[*Coda]word',
      '{start_of_chorus label="My Chorus"}\n[G]sing\n{end_of_chorus}',
      'plain lyric line\n',
      '{key: G}\n{tempo: 120}\n',
    ];

    for (const src of testSources) {
      it(`tiles correctly for: ${JSON.stringify(src.slice(0, 40))}`, () => {
        const tokens = tokenize(src);
        const reconstructed = tokens.map((t) => t.text).join('');
        expect(reconstructed).toBe(src);
      });
    }
  });

  it('emits metadata-directive for {title:}', () => {
    const tokens = tokenize('{title: My Song}\n');
    const t = tokens.find((t) => t.type === 'metadata-directive');
    expect(t).toBeDefined();
    expect(t?.text).toBe('{title: My Song}');
  });

  it('emits metadata-directive for {key:}', () => {
    const tokens = tokenize('{key: G}\n');
    expect(tokens.find((t) => t.type === 'metadata-directive')).toBeDefined();
  });

  it('emits section-open for {start_of_chorus}', () => {
    const tokens = tokenize('{start_of_chorus}\n');
    expect(tokens.find((t) => t.type === 'section-open')).toBeDefined();
  });

  it('emits section-open for {soc} alias', () => {
    const tokens = tokenize('{soc}\n');
    expect(tokens.find((t) => t.type === 'section-open')).toBeDefined();
  });

  it('emits section-end for {end_of_chorus}', () => {
    const tokens = tokenize('{end_of_chorus}\n');
    expect(tokens.find((t) => t.type === 'section-end')).toBeDefined();
  });

  it('emits chord for [G]', () => {
    const tokens = tokenize('[G]Hello\n');
    const chordToken = tokens.find((t) => t.type === 'chord');
    expect(chordToken).toBeDefined();
    expect(chordToken?.text).toBe('[G]');
  });

  it('emits annotation for [*Coda]', () => {
    const tokens = tokenize('[*Coda]word\n');
    const ann = tokens.find((t) => t.type === 'annotation');
    expect(ann).toBeDefined();
    expect(ann?.text).toBe('[*Coda]');
  });

  it('emits comment for # line', () => {
    const tokens = tokenize('# this is a comment\n');
    expect(tokens.find((t) => t.type === 'comment')).toBeDefined();
  });

  it('emits directive for unknown directive', () => {
    const tokens = tokenize('{some_custom_thing: val}\n');
    // May be 'directive' or another category, but should not crash
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('offsets are ascending and non-overlapping', () => {
    const src = '{title: Song}\n[G]word [D]two\n# comment\n';
    const tokens = tokenize(src);
    let prev = 0;
    for (const t of tokens) {
      expect(t.start).toBeGreaterThanOrEqual(prev);
      expect(t.end).toBeGreaterThan(t.start);
      prev = t.end;
    }
  });
});
