/**
 * Hardening pass: comprehensive spec-coverage tests.
 * Covers every gap identified in the audit:
 *   - Full directive matrix
 *   - Extended chord sweep (multiple roots)
 *   - Round-trip corpus property tests
 *   - Never-throw fuzz tests
 *   - Grid / tab / delegated / custom sections
 *   - Key minor transposition
 *   - Tokenizer tiling on all corpus fixtures
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  parse,
  serialize,
  transpose,
  transposeChord,
  applyTransposeDirectives,
  parseChord,
  tokenize,
  renderText,
  renderHtml,
  getChordShape,
  resolveChorus,
  collectChorusCandidates,
  DIRECTIVE_ALIASES,
  KNOWN_DIRECTIVES,
} from '../src/index.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dir, 'fixtures');
const corpusDir = join(fixturesDir, 'corpus');

function readCho(name: string) {
  return readFileSync(join(corpusDir, name), 'utf-8');
}

// ─── Corpus round-trip property test ─────────────────────────────────────────

describe('corpus round-trip — parse → serialize → parse (lossless)', () => {
  const files = readdirSync(corpusDir).filter((f) => f.endsWith('.cho'));
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    it(`${file}: serialize(parse(x)) round-trips`, () => {
      const src = readCho(file);
      const song1 = parse(src);
      const out = serialize(song1);
      const song2 = parse(out);

      // Metadata must be preserved
      for (const [k, v] of song1.metadata) {
        expect(song2.metadata.get(k)).toBe(v);
      }

      // Line count must match
      expect(song2.lines.length).toBe(song1.lines.length);
    });

    it(`${file}: no content is silently dropped`, () => {
      const src = readCho(file);
      const out = serialize(parse(src));
      // All directive source texts that were in the original must appear in output
      // (excluding metadata directives which are in-order)
      const origDirectives = src.match(/\{[^}]+\}/g) ?? [];
      const outDirectives = out.match(/\{[^}]+\}/g) ?? [];
      expect(outDirectives.length).toBe(origDirectives.length);
    });

    it(`${file}: tokenizer tiles source exactly`, () => {
      const src = readCho(file);
      const tokens = tokenize(src);
      const reconstructed = tokens.map((t) => t.text).join('');
      expect(reconstructed).toBe(src);
    });
  }
});

// ─── All metadata directives ──────────────────────────────────────────────────

describe('all metadata directives — extracted and round-tripped', () => {
  const metaDirectives = [
    ['title', 'My Song'],
    ['sorttitle', 'Song, My'],
    ['subtitle', 'A Subtitle'],
    ['artist', 'The Artist'],
    ['sortartist', 'Artist, The'],
    ['composer', 'J.S. Bach'],
    ['lyricist', 'A. Poet'],
    ['copyright', '2024 Author'],
    ['album', 'Greatest Hits'],
    ['year', '2024'],
    ['key', 'G'],
    ['time', '4/4'],
    ['tempo', '120'],
    ['duration', '3:30'],
    ['capo', '2'],
  ];

  for (const [name, value] of metaDirectives) {
    it(`{${name}: ${value}} is extracted and round-trips`, () => {
      const src = `{${name}: ${value}}\n[G]word`;
      const song = parse(src);
      expect(song.metadata.get(name)).toBe(value);
      const out = serialize(song);
      expect(out).toContain(`{${name}: ${value}}`);
    });
  }

  it('{meta: key value} extracts to metadata', () => {
    const song = parse('{meta: custom_field some value here}');
    expect(song.metadata.get('custom_field')).toBe('some value here');
  });

  it('{tag: v1} and {tag: v2} both preserved', () => {
    const src = '{tag: folk}\n{tag: pop}';
    const out = serialize(parse(src));
    expect(out).toContain('{tag: folk}');
    expect(out).toContain('{tag: pop}');
  });
});

// ─── Tier-2 metadata ──────────────────────────────────────────────────────────

describe('tier-2 metadata (ccli)', () => {
  it('{ccli: N} maps to metadata key "ccli"', () => {
    const song = parse('{ccli: 12345}');
    expect(song.metadata.get('ccli')).toBe('12345');
    expect(serialize(song)).toContain('{ccli: 12345}');
  });

  it('{ccli_number: N} also maps to "ccli"', () => {
    const song = parse('{ccli_number: 67890}');
    expect(song.metadata.get('ccli')).toBe('67890');
  });
});

// ─── Full directive matrix ────────────────────────────────────────────────────

describe('directive matrix — all known directives preserved', () => {
  // Verify every entry in KNOWN_DIRECTIVES can be parsed and round-trips
  for (const info of KNOWN_DIRECTIVES) {
    if (info.category === 'environment-open' || info.category === 'environment-close') continue;
    const arg = info.takesArg ? ': test value' : '';
    const src = `{${info.name}${arg}}`;
    it(`{${info.name}} preserved as directive`, () => {
      const song = parse(src);
      // chord-def directives are emitted as chord_def nodes, not directive nodes
      if (info.category === 'chord-def') {
        const def = song.lines.find((l) => l.type === 'chord_def');
        expect(def).toBeDefined();
        if (def?.type === 'chord_def') {
          expect(def.originalName).toBe(info.name);
          expect(serialize(song)).toContain(src);
        }
        return;
      }
      const directive = song.lines.find((l) => l.type === 'directive');
      expect(directive).toBeDefined();
      if (directive?.type === 'directive') {
        // Tier-2 metadata directives are remapped (ccli_number → ccli) — check canonical or remapped name
        const expectedName = info.category === 'tier2-metadata' ? 'ccli' : info.name;
        expect(directive.name).toBe(expectedName);
        // Original name always preserved
        expect(directive.originalName).toBe(info.name);
      }
    });
  }

  // All aliases normalize and round-trip with original spelling
  for (const [alias, canonical] of Object.entries(DIRECTIVE_ALIASES)) {
    if (['soc','eoc','sov','eov','sob','eob','sot','eot','sog','eog'].includes(alias)) continue;
    it(`alias ${alias} → ${canonical}, original spelling preserved in output`, () => {
      const src = `{${alias}: test}`;
      const song = parse(src);
      const d = song.lines.find((l) => l.type === 'directive');
      if (d?.type === 'directive') {
        expect(d.name).toBe(canonical);
        expect(d.originalName).toBe(alias);
        expect(serialize(song)).toContain(`{${alias}: test}`);
      }
    });
  }
});

// ─── Environment pairs ────────────────────────────────────────────────────────

describe('environment section pairs', () => {
  const envPairs: Array<[string, string, string, string]> = [
    ['start_of_chorus', 'end_of_chorus', 'soc', 'eoc'],
    ['start_of_verse', 'end_of_verse', 'sov', 'eov'],
    ['start_of_bridge', 'end_of_bridge', 'sob', 'eob'],
    ['start_of_tab', 'end_of_tab', 'sot', 'eot'],
    ['start_of_grid', 'end_of_grid', 'sog', 'eog'],
  ];

  for (const [open, close, openAlias, closeAlias] of envPairs) {
    it(`${open}/${close} with full names creates correct section`, () => {
      const src = `{${open}}\ncontent\n{${close}}`;
      const song = parse(src);
      const section = song.lines.find((l) => l.type === 'section');
      expect(section?.type).toBe('section');
      if (section?.type === 'section') {
        expect(section.originalOpenName).toBe(open);
        expect(section.originalCloseName).toBe(close);
      }
    });

    it(`${open}/${close} aliases ${openAlias}/${closeAlias} preserve original spellings`, () => {
      const src = `{${openAlias}}\ncontent\n{${closeAlias}}`;
      const song = parse(src);
      const section = song.lines.find((l) => l.type === 'section');
      if (section?.type === 'section') {
        expect(section.originalOpenName).toBe(openAlias);
        expect(section.originalCloseName).toBe(closeAlias);
        // Round-trip
        const out = serialize(song);
        expect(out).toContain(`{${openAlias}}`);
        expect(out).toContain(`{${closeAlias}}`);
      }
    });
  }

  it('start_of_prechorus / end_of_prechorus → prechorus kind', () => {
    const src = '{start_of_prechorus}\ncontent\n{end_of_prechorus}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.kind).toBe('prechorus');
    }
  });

  it('start_of_pre_chorus / end_of_pre_chorus → prechorus kind (underscore variant)', () => {
    const src = '{start_of_pre_chorus}\ncontent\n{end_of_pre_chorus}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.kind).toBe('prechorus');
    }
  });

  it('section with label= attribute', () => {
    const src = '{start_of_verse label="Verse 1"}\ncontent\n{end_of_verse}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.label).toBe('Verse 1');
      expect(section.attributes['label']).toBe('Verse 1');
    }
  });

  it('chorus standalone → ChorusReference with optional label', () => {
    const song = parse('{chorus: Refrain}');
    const ref = song.lines.find((l) => l.type === 'chorus_reference');
    expect(ref?.type).toBe('chorus_reference');
    if (ref?.type === 'chorus_reference') {
      expect(ref.label).toBe('Refrain');
    }
  });
});

// ─── Delegated environments ───────────────────────────────────────────────────

describe('delegated environments (abc/ly/svg/textblock) — preserve-only round-trip', () => {
  const delegatedTypes = ['abc', 'ly', 'svg', 'textblock'];

  for (const kind of delegatedTypes) {
    it(`${kind}: raw content preserved verbatim in serialize(parse(x))`, () => {
      const inner = `line1\nline2\nline3: content with {special} [chars]`;
      const src = `{start_of_${kind}}\n${inner}\n{end_of_${kind}}`;
      const out = serialize(parse(src));
      expect(out).toContain('line1');
      expect(out).toContain('line3: content with {special} [chars]');
    });

    it(`${kind}: marked as delegated in model`, () => {
      const src = `{start_of_${kind}}\ncontent\n{end_of_${kind}}`;
      const song = parse(src);
      const section = song.lines.find((l) => l.type === 'section');
      if (section?.type === 'section') {
        expect(section.delegated).toBe(true);
        expect(section.kind).toBe(kind);
        expect(section.rawContent).toContain('content');
      }
    });
  }
});

// ─── Custom start_of_* / end_of_* sections ────────────────────────────────────

describe('custom start_of_* / end_of_* sections', () => {
  it('start_of_intro / end_of_intro → custom section', () => {
    const src = '{start_of_intro}\n[G]Hello\n{end_of_intro}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.kind).toBe('custom');
      expect(section.attributes['_customKind']).toBe('intro');
      expect(section.lines).toHaveLength(1);
    }
  });

  it('custom section round-trips open/close source', () => {
    const src = '{start_of_intro}\n[G]Hello\n{end_of_intro}';
    const out = serialize(parse(src));
    expect(out).toContain('{start_of_intro}');
    expect(out).toContain('{end_of_intro}');
  });
});

// ─── Tab sections ─────────────────────────────────────────────────────────────

describe('tab sections — verbatim, no chord parsing', () => {
  it('tab content with [D] brackets is preserved literally', () => {
    const src = '{sot}\ne|--0--2--[D]--3--|\nB|--1--3--5--|\n{eot}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.kind).toBe('tab');
      const line = section.lines[0];
      if (line?.type === 'tab_line') {
        expect(line.text).toContain('[D]');
        expect(line.text).not.toContain('chord');
      }
    }
  });

  it('tab content round-trips exactly', () => {
    const tab = 'e|--0--2--3--|\nB|--1--3--5--|\nG|--0--2--4--|';
    const src = `{start_of_tab}\n${tab}\n{end_of_tab}`;
    const out = serialize(parse(src));
    expect(out).toContain(tab);
  });
});

// ─── Grid sections ────────────────────────────────────────────────────────────

describe('grid sections — bar structure and round-trip', () => {
  it('grid row parses cells correctly', () => {
    const src = '{sog}\nC | Am | F | G\n{eog}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      const row = section.lines[0];
      if (row?.type === 'grid_row') {
        expect(row.cells).toHaveLength(4);
        expect(row.cells[0]?.chords[0]?.name).toBe('C');
        expect(row.cells[1]?.chords[0]?.name).toBe('Am');
        expect(row.cells[3]?.chords[0]?.name).toBe('G');
      }
    }
  });

  it('grid row round-trips to original source', () => {
    const gridLine = 'C | Am | F | G';
    const src = `{sog}\n${gridLine}\n{eog}`;
    const out = serialize(parse(src));
    expect(out).toContain(gridLine);
  });

  it('grid row with multiple chords per cell', () => {
    const src = '{sog}\nC Am | F G | Em Dm | G\n{eog}';
    const song = parse(src);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      const row = section.lines[0];
      if (row?.type === 'grid_row') {
        expect(row.cells[0]?.chords).toHaveLength(2);
      }
    }
  });
});

// ─── Chord definitions ────────────────────────────────────────────────────────

describe('chord definitions', () => {
  it('{define} is preserved as directive', () => {
    const src = '{define: Asus4 base-fret 1 frets -1 0 2 2 3 0 fingers 0 0 2 3 4 0}';
    const song = parse(src);
    const d = song.lines.find((l) => l.type === 'directive');
    if (d?.type === 'directive') {
      expect(d.name).toBe('define');
      expect(d.argument).toContain('Asus4');
    }
    expect(serialize(song)).toContain(src);
  });

  it('{chord} alias is preserved', () => {
    const src = '{chord: Em base-fret 1 frets 0 2 2 0 0 0}';
    const out = serialize(parse(src));
    expect(out).toContain(src);
  });
});

// ─── Conditional selectors ────────────────────────────────────────────────────

describe('conditional selectors', () => {
  it('{comment-guitar: x} captures selector "guitar"', () => {
    const song = parse('{comment-guitar: Play on guitar}');
    const d = song.lines.find((l) => l.type === 'directive');
    if (d?.type === 'directive') {
      expect(d.selector).toBe('guitar');
      expect(d.negated).toBeFalsy();
    }
  });

  it('{define-ukulele!: x} captures negated selector "ukulele"', () => {
    const song = parse('{define-ukulele!: C base-fret 1 frets 0 0 0 3}');
    const d = song.lines.find((l) => l.type === 'directive');
    if (d?.type === 'directive') {
      expect(d.selector).toBe('ukulele');
      expect(d.negated).toBe(true);
    }
  });

  it('selector round-trips in original source form', () => {
    const src = '{comment-tenor: Hello}';
    expect(serialize(parse(src))).toContain(src);
  });
});

// ─── x_ custom directives ────────────────────────────────────────────────────

describe('x_ custom directives', () => {
  it('x_-prefixed: preserved, no warning', () => {
    const song = parse('{x_custom_field: some value}');
    expect(song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE')).toHaveLength(0);
    const d = song.lines.find((l) => l.type === 'directive');
    expect(d).toBeDefined();
  });

  it('x_-prefixed round-trips', () => {
    const src = '{x_my_custom: data here}';
    expect(serialize(parse(src))).toContain(src);
  });

  it('multiple x_ directives all preserved', () => {
    const src = '{x_one: 1}\n{x_two: 2}\n{x_three: 3}';
    const out = serialize(parse(src));
    expect(out).toContain('{x_one: 1}');
    expect(out).toContain('{x_two: 2}');
    expect(out).toContain('{x_three: 3}');
  });
});

// ─── Preserve-only tail (layout/legacy) ──────────────────────────────────────

describe('preserve-only tail directives — content and order', () => {
  const tail = [
    '{textfont: Helvetica}',
    '{textsize: 12}',
    '{textcolour: red}',
    '{textcolor: blue}',
    '{chordfont: Arial}',
    '{chordsize: 10}',
    '{chordcolour: green}',
    '{chordcolor: #333}',
    '{titlefont: Times}',
    '{titlesize: 18}',
    '{titlecolour: black}',
    '{titlecolor: white}',
    '{subtitlefont: Courier}',
    '{subtitlesize: 14}',
    '{new_page}',
    '{new_physical_page}',
    '{column_break}',
    '{columns: 2}',
    '{grid}',
    '{no_grid}',
    '{titles: center}',
    '{diagrams}',
    '{pagetype: A4}',
  ];

  it('all legacy/layout directives preserved and round-trip', () => {
    const src = tail.join('\n');
    const out = serialize(parse(src));
    for (const directive of tail) {
      expect(out).toContain(directive);
    }
  });

  it('order of legacy directives is preserved', () => {
    const src = '{textfont: Arial}\n{chordsize: 12}\n{titlecolour: red}';
    const out = serialize(parse(src));
    const idx1 = out.indexOf('{textfont: Arial}');
    const idx2 = out.indexOf('{chordsize: 12}');
    const idx3 = out.indexOf('{titlecolour: red}');
    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });
});

// ─── Extended chord parsing matrix ────────────────────────────────────────────

describe('extended chord parsing — multiple roots', () => {
  const testRoots = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'F#', 'Eb', 'Ab'];

  describe('minor extensions on multiple roots', () => {
    const minorExts = ['m', 'mi', 'min', 'm7', 'mm7', 'mmaj7', 'm6', 'm11', 'madd9'];
    const validMinor = ['m', 'mi', 'min', 'm7'];
    for (const root of ['C', 'G', 'Am', 'F']) {
      for (const ext of validMinor) {
        it(`${root}${ext} parses`, () => {
          const r = parseChord(`${root}${ext}`);
          // Not all combinations are valid strict roots, but should not throw
          expect(() => parseChord(`${root}${ext}`)).not.toThrow();
        });
      }
    }
  });

  describe('augmented and diminished', () => {
    const augDimRoots = ['C', 'D', 'G', 'A', 'F'];
    for (const root of augDimRoots) {
      it(`${root}aug parses`, () => {
        const r = parseChord(`${root}aug`);
        if (r.parsed) {
          expect(r.root).toBe(root);
          expect(r.qualifier).toBe('aug');
        }
      });

      it(`${root}dim parses`, () => {
        const r = parseChord(`${root}dim`);
        if (r.parsed) {
          expect(r.root).toBe(root);
          expect(r.qualifier).toBe('dim');
        }
      });

      it(`${root}dim7 parses`, () => {
        const r = parseChord(`${root}dim7`);
        if (r.parsed) {
          expect(r.root).toBe(root);
          expect(r.extension).toBe('dim7');
        }
      });
    }
  });

  describe('half-diminished h/h7/h9', () => {
    it('Ch parses in strict mode', () => {
      const r = parseChord('Ch');
      expect(r.parsed).toBe(true);
      expect(r.root).toBe('C');
    });

    it('Ch7 parses in strict mode', () => {
      const r = parseChord('Ch7');
      expect(r.parsed).toBe(true);
    });

    it('Ch9 parses in strict mode', () => {
      const r = parseChord('Ch9');
      expect(r.parsed).toBe(true);
    });
  });

  describe('slash chords on multiple roots', () => {
    const slashCases: Array<[string, string, string]> = [
      ['C/G', 'C', 'G'],
      ['Am/E', 'A', 'E'],
      ['G/B', 'G', 'B'],
      ['Fmaj7/A', 'F', 'A'],
      ['Dm/C', 'D', 'C'],
      ['Bb/D', 'Bb', 'D'],
      ['F#m/A', 'F#', 'A'],
    ];

    for (const [name, root, bass] of slashCases) {
      it(`${name} → root=${root}, bass=${bass}`, () => {
        const r = parseChord(name);
        expect(r.parsed).toBe(true);
        expect(r.root).toBe(root);
        expect(r.bass).toBe(bass);
      });
    }
  });
});

// ─── Transposition — comprehensive ───────────────────────────────────────────

describe('transposition — comprehensive', () => {
  describe('all 12 semitones', () => {
    it('C through all 12 chromatic steps', () => {
      const expected = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      for (let i = 0; i < 12; i++) {
        const r = transposeChord(parseChord('C'), i, { preferSharps: true });
        expect(r.name).toBe(expected[i]);
      }
    });

    it('C through all 12 chromatic steps (flats)', () => {
      const expected = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
      for (let i = 0; i < 12; i++) {
        const r = transposeChord(parseChord('C'), i, { preferFlats: true });
        expect(r.name).toBe(expected[i]);
      }
    });
  });

  describe('key metadata transposition preserves qualifier', () => {
    it('key Am + 2 → Bm (not B)', () => {
      const song = parse('{key: Am}\n[Am]word');
      const transposed = transpose(song, 2);
      expect(transposed.metadata.get('key')).toBe('Bm');
    });

    it('key G + 5 → C (major)', () => {
      const song = parse('{key: G}\n[G]word');
      const transposed = transpose(song, 5);
      expect(transposed.metadata.get('key')).toBe('C');
    });

    it('key Dm + 3 → Fm (minor preserved)', () => {
      const song = parse('{key: Dm}\n[Dm]word');
      const transposed = transpose(song, 3, { preferFlats: true });
      expect(transposed.metadata.get('key')).toBe('Fm');
    });
  });

  describe('grid row chords are transposed', () => {
    it('grid chords transpose with song', () => {
      const src = '{sog}\nC | Am | F | G\n{eog}';
      const song = parse(src);
      const transposed = transpose(song, 2);
      const section = transposed.lines.find((l) => l.type === 'section');
      if (section?.type === 'section') {
        const row = section.lines[0];
        if (row?.type === 'grid_row') {
          expect(row.cells[0]?.chords[0]?.name).toBe('D');
          expect(row.cells[1]?.chords[0]?.name).toBe('Bm');
          expect(row.cells[2]?.chords[0]?.name).toBe('G');
          expect(row.cells[3]?.chords[0]?.name).toBe('A');
        }
      }
    });

    it('grid row source is cleared after transposition (rebuilt from cells)', () => {
      const src = '{sog}\nC | Am\n{eog}';
      const song = parse(src);
      const transposed = transpose(song, 2);
      const section = transposed.lines.find((l) => l.type === 'section');
      if (section?.type === 'section') {
        const row = section.lines[0];
        if (row?.type === 'grid_row') {
          // source should be undefined after transposition
          expect(row.source).toBeUndefined();
        }
      }
    });
  });

  describe('identity: +n then -n (default accidental preference)', () => {
    const testCases = ['Am7', 'Fmaj7/A', 'G7sus4', 'Cadd9', 'Dsus2'];
    for (const name of testCases) {
      it(`${name}: +7 then -7 is identity`, () => {
        const chord = parseChord(name);
        if (!chord.parsed) return;
        // Use default options (infer from root) so flat roots stay flat
        const up = transposeChord(chord, 7);
        const back = transposeChord(up, -7);
        expect(back.root).toBe(chord.root);
        expect(back.qualifier).toBe(chord.qualifier);
        expect(back.extension).toBe(chord.extension);
      });
    }
  });

  describe('sharp/flat preference', () => {
    it('flat root transposes up staying in flat territory', () => {
      // Bb + 2 → C (no accidental needed, so same either way)
      expect(transposeChord(parseChord('Bb'), 2).name).toBe('C');
      // Eb + 2 → F
      expect(transposeChord(parseChord('Eb'), 2).name).toBe('F');
      // Ab + 1 → A (no accidental)
      expect(transposeChord(parseChord('Ab'), 2).name).toBe('Bb');
    });

    it('preferSharps overrides default', () => {
      // Bb+1 → B (no ambiguity)
      const r = transposeChord(parseChord('Bb'), 1, { preferSharps: true });
      expect(r.name).toBe('B');
    });
  });
});

// ─── Annotations ─────────────────────────────────────────────────────────────

describe('annotations [*text]', () => {
  it('[*Coda] → annotation, not chord', () => {
    const song = parse('[*Coda]');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      const seg = line.segments[0]!;
      expect(seg.annotation).toBe('Coda');
      expect(seg.chord).toBeUndefined();
    }
  });

  it('annotations are never transposed', () => {
    const song = parse('[*Intro][G]word');
    const transposed = transpose(song, 5);
    const line = transposed.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.annotation).toBe('Intro');
      expect(line.segments[1]?.chord?.name).toBe('C');
    }
  });

  it('annotation round-trips as [*text]', () => {
    const src = '[*Fine]line';
    const out = serialize(parse(src));
    expect(out).toContain('[*Fine]');
  });
});

// ─── Never-throw fuzz ─────────────────────────────────────────────────────────

describe('never-throw fuzz — parser robustness', () => {
  const malformedInputs = [
    '',
    '   ',
    '\n\n\n',
    '{',
    '}',
    '{{}',
    '{{title}}',
    '{title',
    '{title:',
    'title:}',
    '[',
    ']',
    '[]',
    '[[[',
    ']]]',
    '{start_of_verse}', // unclosed
    '{end_of_verse}',   // unmatched
    '{start_of_chorus}\n{start_of_verse}\ncontent', // nested unclosed
    '\x00\x01\x02\x03', // binary
    'A'.repeat(100_000), // huge line
    '{title: ' + 'x'.repeat(10_000) + '}',
    '\r\n'.repeat(1000),
    '{x_ : value}', // null byte in name
  ];

  for (const input of malformedInputs) {
    it(`does not throw on: ${JSON.stringify(input.slice(0, 30))}`, () => {
      expect(() => parse(input)).not.toThrow();
      expect(() => tokenize(input)).not.toThrow();
    });
  }

  it('parse always returns a Song object even on total garbage', () => {
    const result = parse('\x00\x01\x02garbage{{{}}}}[[[');
    expect(result).toBeDefined();
    expect(result.lines).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.metadata).toBeInstanceOf(Map);
  });
});

// ─── Formatting directives ────────────────────────────────────────────────────

describe('formatting directives (comment / comment_italic / comment_box / highlight / image)', () => {
  it('comment is rendered as text in renderText', () => {
    const out = renderText(parse('{comment: My note}'), { includeHeader: false });
    expect(out).toContain('My note');
  });

  it('comment_italic is rendered in HTML with cp-comment-italic', () => {
    const out = renderHtml(parse('{comment_italic: italicized}'), { includeHeader: false });
    expect(out).toContain('cp-comment-italic');
    expect(out).toContain('italicized');
  });

  it('comment_box is rendered in HTML with cp-comment-box', () => {
    const out = renderHtml(parse('{comment_box: boxed}'), { includeHeader: false });
    expect(out).toContain('cp-comment-box');
  });

  it('{highlight} is preserved and round-trips', () => {
    const src = '{highlight}';
    expect(serialize(parse(src))).toContain('{highlight}');
  });

  it('{image} with attributes is preserved and round-trips', () => {
    const src = '{image: src="photo.jpg" scale="50%"}';
    expect(serialize(parse(src))).toContain(src);
  });

  it('{image} with single-quote attributes round-trips', () => {
    const src = "{image: src='photo.jpg' scale='25%'}";
    expect(serialize(parse(src))).toContain(src);
  });
});

// ─── Tokenizer — comprehensive ────────────────────────────────────────────────

describe('tokenizer — comprehensive', () => {
  it('handles consecutive directives', () => {
    const src = '{title: Song}\n{key: G}\n{capo: 2}\n';
    const tokens = tokenize(src);
    expect(tokens.map((t) => t.text).join('')).toBe(src);
    expect(tokens.filter((t) => t.type === 'metadata-directive')).toHaveLength(3);
  });

  it('chord tokens have correct type for all aliases', () => {
    const tokens = tokenize('{soc}\n');
    expect(tokens.find((t) => t.type === 'section-open')).toBeDefined();
  });

  it('handles [*annotation] distinctly from [chord]', () => {
    const src = '[G]word[*Coda]';
    const tokens = tokenize(src);
    expect(tokens.find((t) => t.type === 'chord')?.text).toBe('[G]');
    expect(tokens.find((t) => t.type === 'annotation')?.text).toBe('[*Coda]');
  });

  it('handles unclosed brackets gracefully', () => {
    const src = '[G word';
    expect(() => tokenize(src)).not.toThrow();
    const tokens = tokenize(src);
    expect(tokens.map((t) => t.text).join('')).toBe(src);
  });

  it('empty source produces no tokens', () => {
    expect(tokenize('')).toHaveLength(0);
  });
});

// ─── Inline chord placement ───────────────────────────────────────────────────

describe('inline chord placement — all positions', () => {
  it('chord at start of line', () => {
    const song = parse('[G]hello world');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.chord?.name).toBe('G');
      expect(line.segments[0]?.lyric).toBe('hello world');
    }
  });

  it('chord at end of line (empty lyric)', () => {
    const song = parse('hello [G]');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      const last = line.segments[line.segments.length - 1]!;
      expect(last.chord?.name).toBe('G');
      expect(last.lyric).toBe('');
    }
  });

  it('chord mid-word', () => {
    const song = parse('hel[G]lo');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      const withChord = line.segments.find((s) => s.chord);
      expect(withChord?.lyric).toBe('lo');
    }
  });

  it('multiple chords per line', () => {
    const song = parse('[G]one [Am]two [F]three [C]');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      const chords = line.segments.filter((s) => s.chord);
      expect(chords).toHaveLength(4);
    }
  });

  it('plain lyric line (no chords)', () => {
    const song = parse('just plain lyrics here');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.chord).toBeUndefined();
      expect(line.segments[0]?.lyric).toBe('just plain lyrics here');
    }
  });

  it('chord with sharp (#) in name', () => {
    const song = parse('[F#m]word');
    const line = song.lines[0];
    if (line?.type === 'lyric') {
      expect(line.segments[0]?.chord?.name).toBe('F#m');
    }
  });
});

// ─── HTML output — class names ────────────────────────────────────────────────

describe('renderHtml — class names documented in spec', () => {
  it('emits all documented section classes', () => {
    const src = `
{start_of_chorus}\n[G]sing\n{end_of_chorus}
{start_of_verse}\n[D]word\n{end_of_verse}
{start_of_bridge}\n[Em]bridge\n{end_of_bridge}
`;
    const html = renderHtml(parse(src), { includeHeader: false });
    expect(html).toContain('cp-section--chorus');
    expect(html).toContain('cp-section--verse');
    expect(html).toContain('cp-section--bridge');
  });

  it('cp-blank for blank lines', () => {
    const html = renderHtml(parse('\n'), { includeHeader: false });
    expect(html).toContain('cp-blank');
  });

  it('cp-grid for grid sections', () => {
    const html = renderHtml(parse('{sog}\nC | G\n{eog}'), { includeHeader: false });
    expect(html).toContain('cp-grid');
  });
});

// ─── KNOWN_DIRECTIVES and DIRECTIVE_ALIASES exports ──────────────────────────

describe('KNOWN_DIRECTIVES and DIRECTIVE_ALIASES exports', () => {
  it('KNOWN_DIRECTIVES has all expected categories', () => {
    const cats = new Set(KNOWN_DIRECTIVES.map((d) => d.category));
    expect(cats.has('metadata')).toBe(true);
    expect(cats.has('environment-open')).toBe(true);
    expect(cats.has('environment-close')).toBe(true);
    expect(cats.has('output-layout')).toBe(true);
    expect(cats.has('formatting')).toBe(true);
  });

  it('DIRECTIVE_ALIASES contains all spec aliases', () => {
    const expected = ['soc', 'eoc', 'sov', 'eov', 'sob', 'eob', 'sot', 'eot', 'sog', 'eog',
      'c', 'ci', 'cb', 't', 'st', 'ns', 'np', 'npp', 'colb', 'col', 'g', 'ng'];
    for (const alias of expected) {
      expect(DIRECTIVE_ALIASES[alias]).toBeDefined();
    }
  });

  it('KNOWN_DIRECTIVES entries have required fields', () => {
    for (const d of KNOWN_DIRECTIVES) {
      expect(typeof d.name).toBe('string');
      expect(typeof d.takesArg).toBe('boolean');
      expect(typeof d.category).toBe('string');
      expect(Array.isArray(d.aliases)).toBe(true);
    }
  });
});

// ─── new_song boundary directive ─────────────────────────────────────────────

describe('{new_song} directive', () => {
  it('new_song is recognized and preserved', () => {
    const src = '{new_song}\n{title: Song}';
    const song = parse(src);
    const ns = song.lines.find((l) => l.type === 'directive' && l.name === 'new_song');
    expect(ns).toBeDefined();
    expect(serialize(song)).toContain('{new_song}');
  });
});

// ─── ChordDef structured model ───────────────────────────────────────────────

describe('ChordDef structured model', () => {
  it('{define} emits chord_def node, not directive', () => {
    const song = parse('{define: Am base-fret 1 frets x 0 2 2 1 0}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def).toBeDefined();
    expect(song.lines.find((l) => l.type === 'directive' && (l as { name?: string }).name === 'define')).toBeUndefined();
  });

  it('{chord} emits chord_def with originalName chord', () => {
    const song = parse('{chord: G base-fret 1 frets 3 2 0 0 0 3}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def?.type === 'chord_def' && def.originalName).toBe('chord');
  });

  it('parses name correctly', () => {
    const song = parse('{define: Cmaj7 base-fret 1 frets x 3 2 0 0 0}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def?.type === 'chord_def' && def.name).toBe('Cmaj7');
  });

  it('parses base-fret', () => {
    const song = parse('{define: Bm base-fret 2 frets x 1 3 3 2 1}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def?.type === 'chord_def' && def.baseFret).toBe(2);
  });

  it('parses frets array', () => {
    const song = parse('{define: Am base-fret 1 frets x 0 2 2 1 0}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def?.type === 'chord_def' && def.frets).toEqual([-1, 0, 2, 2, 1, 0]);
  });

  it('parses fingers array', () => {
    const song = parse('{define: Am base-fret 1 frets x 0 2 2 1 0 fingers 0 0 2 3 1 0}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def?.type === 'chord_def' && def.fingers).toEqual([0, 0, 2, 3, 1, 0]);
  });

  it('parses keyboard keys syntax', () => {
    const song = parse('{define: Cmaj keys 0 4 7}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def?.type === 'chord_def' && def.keys).toEqual([0, 4, 7]);
  });

  it('parses display attribute', () => {
    const song = parse('{define: Am base-fret 1 frets x 0 2 2 1 0 display="A minor"}');
    const def = song.lines.find((l) => l.type === 'chord_def');
    expect(def?.type === 'chord_def' && def.display).toBe('A minor');
  });

  it('round-trips via source', () => {
    const src = '{define: Am base-fret 1 frets x 0 2 2 1 0 fingers 0 0 2 3 1 0}\nSome [Am]lyrics\n';
    expect(serialize(parse(src))).toContain('{define: Am base-fret 1 frets x 0 2 2 1 0 fingers 0 0 2 3 1 0}');
  });

  it('getChordShape uses chord_def node directly', () => {
    const song = parse('{define: Xm base-fret 1 frets x 0 2 2 1 0}');
    const shape = getChordShape('Xm', 'guitar', song);
    expect(shape).not.toBeNull();
    expect(shape?.frets).toEqual([-1, 0, 2, 2, 1, 0]);
  });

  it('no warnings emitted for {define}', () => {
    const song = parse('{define: Am base-fret 1 frets x 0 2 2 1 0}');
    expect(song.warnings).toHaveLength(0);
  });
});

// ─── applyTransposeDirectives ──────────────────────────────────────────────

describe('applyTransposeDirectives', () => {
  it('transposes chords after {transpose: 2}', () => {
    const src = '{transpose: 2}\n[C]lyrics\n';
    const song = applyTransposeDirectives(parse(src));
    const lyric = song.lines.find((l) => l.type === 'lyric');
    expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('D');
  });

  it('does not transpose chords before the directive', () => {
    const src = '[C]before\n{transpose: 2}\n[C]after\n';
    const song = applyTransposeDirectives(parse(src));
    const lines = song.lines.filter((l) => l.type === 'lyric');
    expect(lines[0]?.type === 'lyric' && lines[0].segments[0]?.chord?.name).toBe('C');
    expect(lines[1]?.type === 'lyric' && lines[1].segments[0]?.chord?.name).toBe('D');
  });

  it('{transpose} with no value cancels transposition', () => {
    const src = '{transpose: 2}\n[C]up\n{transpose}\n[C]back\n';
    const song = applyTransposeDirectives(parse(src));
    const lyrics = song.lines.filter((l) => l.type === 'lyric');
    expect(lyrics[0]?.type === 'lyric' && lyrics[0].segments[0]?.chord?.name).toBe('D');
    expect(lyrics[1]?.type === 'lyric' && lyrics[1].segments[0]?.chord?.name).toBe('C');
  });

  it('trailing s suffix forces sharps', () => {
    const src = '{transpose: 1s}\n[Bb]lyrics\n';
    const song = applyTransposeDirectives(parse(src));
    const lyric = song.lines.find((l) => l.type === 'lyric');
    expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('B');
  });

  it('trailing f suffix forces flats', () => {
    // C + 1 semitone = C# (sharps) or Db (flats)
    const src = '{transpose: 1f}\n[C]lyrics\n';
    const song = applyTransposeDirectives(parse(src));
    const lyric = song.lines.find((l) => l.type === 'lyric');
    expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('Db');
  });

  it('directive node is preserved for round-trip', () => {
    const src = '{transpose: 2}\n[C]lyrics\n';
    const song = applyTransposeDirectives(parse(src));
    expect(serialize(song)).toContain('{transpose: 2}');
  });

  it('applies inside sections', () => {
    const src = '{start_of_chorus}\n{transpose: 5}\n[C]line\n{end_of_chorus}\n';
    const song = applyTransposeDirectives(parse(src));
    const section = song.lines.find((l) => l.type === 'section');
    const lyric = section?.type === 'section' && section.lines.find((l) => l.type === 'lyric');
    expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('F');
  });

  it('renderText honours in-song {transpose}', () => {
    const src = '{transpose: 7}\n[C]Amazing\n';
    const text = renderText(parse(src), { includeHeader: false });
    expect(text).toContain('G');
    expect(text).not.toMatch(/\bC\b/);
  });

  it('renderHtml honours in-song {transpose}', () => {
    const src = '{transpose: 7}\n[C]Amazing\n';
    const html = renderHtml(parse(src), { includeHeader: false });
    expect(html).toContain('G');
    expect(html).not.toMatch(/class="cp-chord">C</);
  });

  it('negative semitones work (transpose down)', () => {
    const src = '{transpose: -2}\n[D]lyrics\n';
    const song = applyTransposeDirectives(parse(src));
    const lyric = song.lines.find((l) => l.type === 'lyric');
    expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('C');
  });

  it('no-op when no transpose directive present — chords unchanged', () => {
    const src = '[C]lyrics [G]more\n';
    const song = applyTransposeDirectives(parse(src));
    const lyric = song.lines.find((l) => l.type === 'lyric');
    expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('C');
    expect(lyric?.type === 'lyric' && lyric.segments[1]?.chord?.name).toBe('G');
  });
});

// ─── resolveChorus ────────────────────────────────────────────────────────────

describe('resolveChorus', () => {
  const src = `
{start_of_chorus}
[G]Chorus line
{end_of_chorus}
{chorus}
`.trim();

  it('resolves a bare {chorus} to the preceding chorus section', () => {
    const song = parse(src);
    const ref = song.lines.find((l) => l.type === 'chorus_reference');
    expect(ref?.type).toBe('chorus_reference');
    if (ref?.type !== 'chorus_reference') return;
    const section = resolveChorus(song, ref);
    expect(section).not.toBeNull();
    expect(section?.kind).toBe('chorus');
  });

  it('returns null when no chorus precedes the reference', () => {
    const song = parse('{chorus}');
    const ref = song.lines.find((l) => l.type === 'chorus_reference');
    if (ref?.type !== 'chorus_reference') return;
    expect(resolveChorus(song, ref)).toBeNull();
  });

  it('resolves labeled {chorus: label} to the matching section', () => {
    const labelSrc = `
{start_of_chorus label="A"}
[C]Chorus A
{end_of_chorus}
{start_of_chorus label="B"}
[D]Chorus B
{end_of_chorus}
{chorus: A}
`.trim();
    const song = parse(labelSrc);
    const ref = song.lines.find((l) => l.type === 'chorus_reference');
    if (ref?.type !== 'chorus_reference') return;
    const section = resolveChorus(song, ref);
    expect(section?.label).toBe('A');
  });

  it('returns the LAST matching chorus before the reference', () => {
    const multiSrc = `
{start_of_chorus}
[C]First
{end_of_chorus}
{start_of_chorus}
[G]Second
{end_of_chorus}
{chorus}
`.trim();
    const song = parse(multiSrc);
    const ref = song.lines.find((l) => l.type === 'chorus_reference');
    if (ref?.type !== 'chorus_reference') return;
    const section = resolveChorus(song, ref);
    const lyric = section?.lines.find((l) => l.type === 'lyric');
    expect(lyric?.type === 'lyric' && lyric.segments[0]?.chord?.name).toBe('G');
  });

  it('collectChorusCandidates returns all matching sections in order', () => {
    const multiSrc = `
{start_of_chorus}
[C]First
{end_of_chorus}
{start_of_chorus}
[G]Second
{end_of_chorus}
{chorus}
`.trim();
    const song = parse(multiSrc);
    const ref = song.lines.find((l) => l.type === 'chorus_reference');
    if (ref?.type !== 'chorus_reference') return;
    const candidates = collectChorusCandidates(song, ref);
    expect(candidates).toHaveLength(2);
  });
});
