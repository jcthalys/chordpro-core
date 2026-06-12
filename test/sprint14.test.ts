/**
 * Sprint 14 — CR14-1..CR14-4 acceptance tests.
 * CR14-1: Token.category populated from KNOWN_DIRECTIVES
 * CR14-2: categoryOf() and DIRECTIVES_BY_CATEGORY
 * CR14-3: renderHtml data-repeat on sections with {meta: repeat N}
 * CR14-4: renderHtml data-kind on all sections + default section-label fallback
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  categoryOf,
  DIRECTIVES_BY_CATEGORY,
  KNOWN_DIRECTIVES,
  renderHtml,
  parse,
} from '../src/index.js';

// ─── CR14-1 — Token.category ─────────────────────────────────────────────────

describe('CR14-1 — Token.category populated from directive registry', () => {
  it('{key: C} → category: metadata', () => {
    const tokens = tokenize('{key: C}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('metadata');
  });

  it('{title: Amazing Grace} → category: metadata', () => {
    const tokens = tokenize('{title: Amazing Grace}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('metadata');
  });

  it('{ccli: 12345} → category: tier2-metadata', () => {
    const tokens = tokenize('{ccli: 12345}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('tier2-metadata');
  });

  it('{comment: hello} → category: formatting', () => {
    const tokens = tokenize('{comment: hello}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('formatting');
  });

  it('{start_of_chorus} → category: environment-open', () => {
    const tokens = tokenize('{start_of_chorus}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('environment-open');
  });

  it('{soc} alias → category: environment-open (alias normalization)', () => {
    const tokens = tokenize('{soc}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('environment-open');
  });

  it('{end_of_chorus} → category: environment-close', () => {
    const tokens = tokenize('{end_of_chorus}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('environment-close');
  });

  it('{eoc} alias → category: environment-close', () => {
    const tokens = tokenize('{eoc}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('environment-close');
  });

  it('{define: Am base-fret 1 frets 0 0 2 2 1 0} → category: chord-def', () => {
    const tokens = tokenize('{define: Am base-fret 1 frets 0 0 2 2 1 0}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('chord-def');
  });

  it('{transpose: 2} → category: transposition', () => {
    const tokens = tokenize('{transpose: 2}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('transposition');
  });

  it('{new_song} → category: preamble', () => {
    const tokens = tokenize('{new_song}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBe('preamble');
  });

  it('{unknown_directive} → category absent (undefined)', () => {
    const tokens = tokenize('{unknown_directive}');
    const tok = tokens.find((t) => t.text.startsWith('{'));
    expect(tok?.category).toBeUndefined();
  });

  it('chord token has no category', () => {
    const tokens = tokenize('[Am]hello');
    const chordTok = tokens.find((t) => t.type === 'chord');
    expect(chordTok).toBeDefined();
    expect(chordTok?.category).toBeUndefined();
  });

  it('lyric token has no category', () => {
    const tokens = tokenize('hello world');
    const lyricTok = tokens.find((t) => t.type === 'lyric');
    expect(lyricTok?.category).toBeUndefined();
  });

  it('source still tiles exactly with category present', () => {
    const src = '{key: G}\n{start_of_chorus}\n[C]Amazing grace\n{end_of_chorus}';
    const tokens = tokenize(src);
    expect(tokens.map((t) => t.text).join('')).toBe(src);
  });
});

// ─── CR14-2 — categoryOf() + DIRECTIVES_BY_CATEGORY ─────────────────────────

describe('CR14-2 — categoryOf()', () => {
  it("categoryOf('key') → 'metadata'", () => {
    expect(categoryOf('key')).toBe('metadata');
  });

  it("categoryOf('title') → 'metadata'", () => {
    expect(categoryOf('title')).toBe('metadata');
  });

  it("categoryOf('artist') → 'metadata'", () => {
    expect(categoryOf('artist')).toBe('metadata');
  });

  it("categoryOf('comment') → 'formatting'", () => {
    expect(categoryOf('comment')).toBe('formatting');
  });

  it("categoryOf('start_of_chorus') → 'environment-open'", () => {
    expect(categoryOf('start_of_chorus')).toBe('environment-open');
  });

  it("categoryOf('end_of_chorus') → 'environment-close'", () => {
    expect(categoryOf('end_of_chorus')).toBe('environment-close');
  });

  it("categoryOf('transpose') → 'transposition'", () => {
    expect(categoryOf('transpose')).toBe('transposition');
  });

  it("categoryOf('capo') → 'metadata'", () => {
    expect(categoryOf('capo')).toBe('metadata');
  });

  it("categoryOf('ccli') → 'tier2-metadata'", () => {
    expect(categoryOf('ccli')).toBe('tier2-metadata');
  });

  it("categoryOf('unknown_xyz') → undefined", () => {
    expect(categoryOf('unknown_xyz')).toBeUndefined();
  });
});

describe('CR14-2 — DIRECTIVES_BY_CATEGORY', () => {
  it("DIRECTIVES_BY_CATEGORY['metadata'] contains key, title, artist", () => {
    expect(DIRECTIVES_BY_CATEGORY['metadata']).toContain('key');
    expect(DIRECTIVES_BY_CATEGORY['metadata']).toContain('title');
    expect(DIRECTIVES_BY_CATEGORY['metadata']).toContain('artist');
  });

  it("DIRECTIVES_BY_CATEGORY['transposition'] contains transpose", () => {
    expect(DIRECTIVES_BY_CATEGORY['transposition']).toContain('transpose');
  });

  it("DIRECTIVES_BY_CATEGORY['environment-open'] contains start_of_chorus", () => {
    expect(DIRECTIVES_BY_CATEGORY['environment-open']).toContain('start_of_chorus');
  });

  it("DIRECTIVES_BY_CATEGORY['environment-close'] contains end_of_chorus", () => {
    expect(DIRECTIVES_BY_CATEGORY['environment-close']).toContain('end_of_chorus');
  });

  it("DIRECTIVES_BY_CATEGORY['tier2-metadata'] contains ccli", () => {
    expect(DIRECTIVES_BY_CATEGORY['tier2-metadata']).toContain('ccli');
  });

  it('union of all category lists equals the full KNOWN_DIRECTIVES name set', () => {
    const allFromRegistry = new Set(KNOWN_DIRECTIVES.map((d) => d.name));
    const allFromGrouped = new Set(
      (Object.values(DIRECTIVES_BY_CATEGORY) as string[][]).flat(),
    );
    expect(allFromGrouped).toEqual(allFromRegistry);
  });

  it('all DirectiveCategory keys are present in DIRECTIVES_BY_CATEGORY', () => {
    const expectedKeys = [
      'preamble', 'metadata', 'formatting', 'environment-open', 'environment-close',
      'chord-def', 'transposition', 'output-layout', 'tier2-metadata', 'unknown',
    ];
    for (const key of expectedKeys) {
      expect(DIRECTIVES_BY_CATEGORY).toHaveProperty(key);
    }
  });
});

// ─── CR14-3 — renderHtml data-repeat ─────────────────────────────────────────

describe('CR14-3 — renderHtml emits data-repeat on repeat sections', () => {
  it('verse with {meta: repeat 2} → data-repeat="2"', () => {
    const html = renderHtml(parse('{start_of_verse}\n{meta: repeat 2}\nLine\n{end_of_verse}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-repeat="2"');
  });

  it('verse with {meta: repeat 3} → data-repeat="3"', () => {
    const html = renderHtml(parse('{start_of_verse}\n{meta: repeat 3}\nLine\n{end_of_verse}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-repeat="3"');
  });

  it('chorus with {meta: repeat 2} → data-repeat="2"', () => {
    const html = renderHtml(parse('{start_of_chorus}\n{meta: repeat 2}\nLine\n{end_of_chorus}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-repeat="2"');
  });

  it('verse without repeat meta → no data-repeat attribute', () => {
    const html = renderHtml(parse('{start_of_verse}\nLine\n{end_of_verse}'), {
      includeHeader: false,
    });
    expect(html).not.toContain('data-repeat');
  });

  it('chorus without repeat meta → no data-repeat attribute', () => {
    const html = renderHtml(parse('{start_of_chorus}\nLine\n{end_of_chorus}'), {
      includeHeader: false,
    });
    expect(html).not.toContain('data-repeat');
  });
});

// ─── CR14-4 — renderHtml data-kind + default section-label ───────────────────

describe('CR14-4 — renderHtml emits data-kind on all sections', () => {
  it('verse section → data-kind="verse"', () => {
    const html = renderHtml(parse('{start_of_verse}\nLine\n{end_of_verse}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-kind="verse"');
  });

  it('chorus section → data-kind="chorus"', () => {
    const html = renderHtml(parse('{start_of_chorus}\nLine\n{end_of_chorus}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-kind="chorus"');
  });

  it('bridge section → data-kind="bridge"', () => {
    const html = renderHtml(parse('{start_of_bridge}\nLine\n{end_of_bridge}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-kind="bridge"');
  });
});

describe('CR14-4 — default section-label fallback', () => {
  it('{start_of_verse} with no label → section-label text "Verse"', () => {
    const html = renderHtml(parse('{start_of_verse}\nLine\n{end_of_verse}'), {
      includeHeader: false,
    });
    expect(html).toContain('cp-section-label');
    expect(html).toContain('>Verse<');
  });

  it('{start_of_chorus} with no label → section-label text "Chorus"', () => {
    const html = renderHtml(parse('{start_of_chorus}\nLine\n{end_of_chorus}'), {
      includeHeader: false,
    });
    expect(html).toContain('>Chorus<');
  });

  it('{start_of_bridge} with no label → section-label text "Bridge"', () => {
    const html = renderHtml(parse('{start_of_bridge}\nLine\n{end_of_bridge}'), {
      includeHeader: false,
    });
    expect(html).toContain('>Bridge<');
  });

  it('{start_of_verse label="Verse 1"} → section-label text "Verse 1" (explicit label wins)', () => {
    const html = renderHtml(parse('{start_of_verse label="Verse 1"}\nLine\n{end_of_verse}'), {
      includeHeader: false,
    });
    expect(html).toContain('>Verse 1<');
    expect(html).not.toContain('>Verse<');
  });

  it('custom section → data-kind="custom", section-label present', () => {
    const html = renderHtml(parse('{start_of_mycustom}\nLine\n{end_of_mycustom}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-kind="custom"');
    expect(html).toContain('cp-section-label');
  });

  it('grid section → data-kind="grid"', () => {
    const html = renderHtml(parse('{start_of_grid}\nC | Am | F | G\n{end_of_grid}'), {
      includeHeader: false,
    });
    expect(html).toContain('data-kind="grid"');
  });
});
