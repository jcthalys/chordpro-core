/**
 * Tier 1 — parser + serialize tests.
 * @tier tier1
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parse.js';
import { serialize } from './serialize.js';

// ─── Alias normalization ───────────────────────────────────────────────────────

describe('directive alias normalization', () => {
  // Non-section directives — check as DirectiveLine
  const directiveAliasCases: Array<[string, string]> = [
    ['c', 'comment'],
    ['ci', 'comment_italic'],
    ['cb', 'comment_box'],
    ['t', 'title'],
    ['st', 'subtitle'],
    ['ns', 'new_song'],
    ['np', 'new_page'],
    ['npp', 'new_physical_page'],
    ['colb', 'column_break'],
    ['col', 'columns'],
    ['g', 'grid'],
    ['ng', 'no_grid'],
  ];

  for (const [alias, canonical] of directiveAliasCases) {
    it(`{${alias}: x} normalizes to ${canonical}`, () => {
      const song = parse(`{${alias}: test}`);
      const directive = song.lines.find((l) => l.type === 'directive');
      expect(directive).toBeDefined();
      if (directive?.type === 'directive') {
        expect(directive.name).toBe(canonical);
        expect(directive.originalName).toBe(alias);
      }
    });
  }

  // Section-open/close aliases — check via SectionNode (open+close pair)
  const sectionAliasPairs: Array<[string, string, string]> = [
    ['soc', 'eoc', 'chorus'],
    ['sov', 'eov', 'verse'],
    ['sob', 'eob', 'bridge'],
    ['sot', 'eot', 'tab'],
    ['sog', 'eog', 'grid'],
  ];

  for (const [openAlias, closeAlias, kind] of sectionAliasPairs) {
    it(`{${openAlias}}/{${closeAlias}} normalizes to ${kind} section with original spellings`, () => {
      const song = parse(`{${openAlias}}\nline\n{${closeAlias}}`);
      const section = song.lines.find((l) => l.type === 'section');
      expect(section).toBeDefined();
      if (section?.type === 'section') {
        expect(section.kind).toBe(kind);
        expect(section.originalOpenName).toBe(openAlias);
        expect(section.originalCloseName).toBe(closeAlias);
      }
    });
  }

  it('long name is preserved as-is', () => {
    const song = parse('{title: Hello World}');
    const d = song.lines[0];
    expect(d?.type).toBe('directive');
    if (d?.type === 'directive') {
      expect(d.name).toBe('title');
      expect(d.originalName).toBe('title');
    }
  });
});

// ─── Metadata extraction ──────────────────────────────────────────────────────

describe('metadata extraction', () => {
  it('extracts title and artist', () => {
    const song = parse('{title: Amazing Grace}\n{artist: Traditional}');
    expect(song.metadata.get('title')).toBe('Amazing Grace');
    expect(song.metadata.get('artist')).toBe('Traditional');
  });

  it('extracts key, tempo, capo', () => {
    const song = parse('{key: G}\n{tempo: 120}\n{capo: 2}');
    expect(song.metadata.get('key')).toBe('G');
    expect(song.metadata.get('tempo')).toBe('120');
    expect(song.metadata.get('capo')).toBe('2');
  });

  it('extracts copyright (Tier 1 core)', () => {
    const song = parse('{copyright: 2024 Author}');
    expect(song.metadata.get('copyright')).toBe('2024 Author');
  });

  it('extracts ccli/ccli_number as Tier-2 metadata → key "ccli"', () => {
    const song1 = parse('{ccli: 12345}');
    expect(song1.metadata.get('ccli')).toBe('12345');
    const song2 = parse('{ccli_number: 67890}');
    expect(song2.metadata.get('ccli')).toBe('67890');
  });

  it('handles meta directive', () => {
    const song = parse('{meta: custom_key some value}');
    expect(song.metadata.get('custom_key')).toBe('some value');
  });
});

// ─── Attribute parsing ────────────────────────────────────────────────────────

describe('directive attribute parsing', () => {
  it('parses double-quote attributes', () => {
    const song = parse('{image: src="photo.jpg" scale="50%"}');
    const d = song.lines.find((l) => l.type === 'directive');
    if (d?.type === 'directive') {
      expect(d.attributes['src']).toBe('photo.jpg');
      expect(d.attributes['scale']).toBe('50%');
    }
  });

  it('parses single-quote attributes', () => {
    const song = parse("{image: src='photo.jpg' scale='50%'}");
    const d = song.lines.find((l) => l.type === 'directive');
    if (d?.type === 'directive') {
      expect(d.attributes['src']).toBe('photo.jpg');
      expect(d.attributes['scale']).toBe('50%');
    }
  });

  it('positional label form: {start_of_verse Verse 1}', () => {
    const src = '{start_of_verse Verse 1}\nline\n{end_of_verse}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.label).toBe('Verse 1');
    }
  });

  it('label= form: {start_of_verse label="Verse 1"}', () => {
    const src = '{start_of_verse label="Verse 1"}\nline\n{end_of_verse}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.label).toBe('Verse 1');
    }
  });
});

// ─── Conditional selectors ────────────────────────────────────────────────────

describe('conditional selectors', () => {
  it('parses {comment-tenor: ...} selector', () => {
    const song = parse('{comment-tenor: Hello}');
    const d = song.lines.find((l) => l.type === 'directive');
    if (d?.type === 'directive') {
      expect(d.selector).toBe('tenor');
      expect(d.negated).toBeFalsy();
    }
  });

  it('parses {define-guitar!: ...} negated selector', () => {
    const song = parse('{define-guitar!: Cm}');
    const d = song.lines.find((l) => l.type === 'directive');
    if (d?.type === 'directive') {
      expect(d.selector).toBe('guitar');
      expect(d.negated).toBe(true);
    }
  });

  it('warns when end directive has a selector', () => {
    const song = parse('{soc}\n{eoc-guitar: x}');
    expect(song.warnings.some((w) => w.code === 'SELECTOR_ON_END_DIRECTIVE')).toBe(true);
  });
});

// ─── x_-prefixed directives ───────────────────────────────────────────────────

describe('custom x_ directives', () => {
  it('preserves x_-prefixed directive with no warning', () => {
    const song = parse('{x_custom: value}');
    expect(song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE')).toHaveLength(0);
    const d = song.lines.find((l) => l.type === 'directive');
    expect(d).toBeDefined();
  });
});

// ─── Unknown directives ────────────────────────────────────────────────────────

describe('unknown directives', () => {
  it('emits warning for unknown non-x_ directive', () => {
    const song = parse('{not_a_real_directive: x}');
    expect(song.warnings.some((w) => w.code === 'UNKNOWN_DIRECTIVE')).toBe(true);
  });

  it('preserves unknown directive in model', () => {
    const song = parse('{not_a_real_directive: x}');
    const d = song.lines.find((l) => l.type === 'directive');
    expect(d).toBeDefined();
  });

  it('ignores unknown warnings when onUnknownDirective=ignore', () => {
    const song = parse('{not_a_real_directive: x}', { onUnknownDirective: 'ignore' });
    expect(song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE')).toHaveLength(0);
  });
});

// ─── Sections ─────────────────────────────────────────────────────────────────

describe('section parsing', () => {
  it('parses chorus section', () => {
    const src = '{start_of_chorus}\n[G]Swing [D]low\n{end_of_chorus}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    expect(section?.type).toBe('section');
    if (section?.type === 'section') {
      expect(section.kind).toBe('chorus');
      expect(section.lines).toHaveLength(1);
    }
  });

  it('parses verse section via alias', () => {
    const src = '{sov}\nline\n{eov}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.kind).toBe('verse');
      expect(section.originalOpenName).toBe('sov');
    }
  });

  it('standalone {chorus} → ChorusReference', () => {
    const song = parse('{chorus}');
    const ref = song.lines.find((l) => l.type === 'chorus_reference');
    expect(ref).toBeDefined();
  });

  it('warns on unclosed section', () => {
    const song = parse('{sov}\nline without close');
    expect(song.warnings.some((w) => w.code === 'UNCLOSED_SECTION')).toBe(true);
  });

  it('warns on unmatched end directive', () => {
    const song = parse('{eov}');
    expect(song.warnings.some((w) => w.code === 'UNMATCHED_END')).toBe(true);
  });
});

// ─── Tab blocks ───────────────────────────────────────────────────────────────

describe('tab blocks', () => {
  it('does not parse [D] inside tab block', () => {
    const src = '{start_of_tab}\ne|--2--3--5--|[D]\n{end_of_tab}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      const tabLine = section.lines[0];
      expect(tabLine?.type).toBe('tab_line');
      if (tabLine?.type === 'tab_line') {
        expect(tabLine.text).toContain('[D]');
      }
    }
  });
});

// ─── Delegated sections ───────────────────────────────────────────────────────

describe('delegated sections (abc/ly/svg/textblock)', () => {
  it('preserves abc content verbatim', () => {
    const src = '{start_of_abc}\nX:1\nT:Title\nK:C\n{end_of_abc}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.delegated).toBe(true);
      expect(section.rawContent).toContain('X:1');
    }
  });
});

// ─── Grid sections ────────────────────────────────────────────────────────────

describe('grid sections', () => {
  it('parses grid rows with bar structure', () => {
    const src = '{start_of_grid}\nC | Am | F | G\n{end_of_grid}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.kind).toBe('grid');
      const row = section.lines[0];
      if (row?.type === 'grid_row') {
        expect(row.cells).toHaveLength(4);
        expect(row.cells[0]?.chords[0]?.name).toBe('C');
      }
    }
  });
});

// ─── Robustness (never throw) ─────────────────────────────────────────────────

describe('parser robustness', () => {
  it('handles unclosed directive brace', () => {
    expect(() => parse('{title: x')).not.toThrow();
  });

  it('handles unclosed chord bracket', () => {
    expect(() => parse('[D low sweet')).not.toThrow();
  });

  it('handles stray }', () => {
    expect(() => parse('}')).not.toThrow();
  });

  it('handles stray ]', () => {
    expect(() => parse(']')).not.toThrow();
  });

  it('handles mixed line endings', () => {
    expect(() => parse('line1\r\nline2\rline3\nline4')).not.toThrow();
  });

  it('handles enormous line', () => {
    expect(() => parse('A'.repeat(100_000))).not.toThrow();
  });

  it('handles empty file', () => {
    const song = parse('');
    expect(song.lines).toHaveLength(0);
    expect(song.warnings).toHaveLength(0);
  });

  it('handles file of only comments', () => {
    const song = parse('# comment 1\n# comment 2');
    expect(song.lines).toHaveLength(2);
    expect(song.lines.every((l) => l.type === 'comment')).toBe(true);
  });
});

// ─── Round-trip (serialize ∘ parse = identity) ────────────────────────────────

describe('round-trip (serialize(parse(x)) preserves content)', () => {
  it('preserves simple song', () => {
    const src = '{title: Song}\n{artist: Author}\n[G]Word [D]two\n[Em]three';
    const song = parse(src);
    const out = serialize(song);
    const reparsed = parse(out);
    expect(reparsed.metadata.get('title')).toBe('Song');
    expect(reparsed.metadata.get('artist')).toBe('Author');
  });

  it('preserves comments', () => {
    const src = '# This is a comment\n{title: X}';
    const out = serialize(parse(src));
    expect(out).toContain('# This is a comment');
  });

  it('preserves original chord spellings', () => {
    const src = '[Fmaj7/A]word [Bbmaj7]two';
    const out = serialize(parse(src));
    expect(out).toContain('Fmaj7/A');
    expect(out).toContain('Bbmaj7');
  });

  it('preserves legacy layout directives (output-layout tail)', () => {
    const src = '{textfont: Arial}\n{chordsize: 14}\n{titlecolour: red}';
    const out = serialize(parse(src));
    expect(out).toContain('{textfont: Arial}');
    expect(out).toContain('{chordsize: 14}');
    expect(out).toContain('{titlecolour: red}');
  });

  it('preserves delegated abc block', () => {
    const src = '{start_of_abc}\nX:1\nT:My Tune\nK:G\n{end_of_abc}';
    const out = serialize(parse(src));
    expect(out).toContain('X:1');
    expect(out).toContain('T:My Tune');
  });

  it('preserves directive order', () => {
    const src = '{key: G}\n{tempo: 120}\n{title: Song}';
    const out = serialize(parse(src));
    const kIdx = out.indexOf('{key: G}');
    const tIdx = out.indexOf('{tempo: 120}');
    const sIdx = out.indexOf('{title: Song}');
    expect(kIdx).toBeLessThan(tIdx);
    expect(tIdx).toBeLessThan(sIdx);
  });

  it('preserves original alias spellings', () => {
    const src = '{soc}\n[G]Sing\n{eoc}';
    const out = serialize(parse(src));
    expect(out).toContain('{soc}');
    expect(out).toContain('{eoc}');
  });
});

// ─── Lyric lines ──────────────────────────────────────────────────────────────

describe('lyric line parsing', () => {
  it('parses inline chords', () => {
    const song = parse('Swing [D]low, sweet [G]chari[D]ot');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      const chords = line.segments.filter((s) => s.chord);
      expect(chords.length).toBe(3);
      expect(chords[0]?.chord?.name).toBe('D');
      expect(chords[1]?.chord?.name).toBe('G');
      expect(chords[2]?.chord?.name).toBe('D');
    }
  });

  it('parses annotation [*Coda]', () => {
    const song = parse('[*Coda]');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      const ann = line.segments.find((s) => s.annotation !== undefined);
      expect(ann?.annotation).toBe('Coda');
      expect(ann?.chord).toBeUndefined();
    }
  });

  it('handles leading chord (no preceding lyric)', () => {
    const song = parse('[G]Hello');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.chord?.name).toBe('G');
      expect(line.segments[0]?.lyric).toBe('Hello');
    }
  });

  it('handles trailing chord (no following lyric)', () => {
    const song = parse('Hello [G]');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      const last = line.segments[line.segments.length - 1]!;
      expect(last.chord?.name).toBe('G');
      expect(last.lyric).toBe('');
    }
  });

  it('handles mid-word chord', () => {
    const song = parse('syl[G]la[D]ble');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments.some((s) => s.lyric === 'syl')).toBe(true);
    }
  });
});
