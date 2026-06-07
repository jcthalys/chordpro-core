/**
 * Coverage gap tests — targeted at specific uncovered lines identified by the audit.
 */

import { describe, it, expect } from 'vitest';
import { parse, serialize, parseChord, renderText, renderHtml, getChordShape } from '../src/index.js';

// ─── parseChord — uncovered branches ──────────────────────────────────────────

describe('parseChord coverage gaps', () => {
  // maj/^ prefix in strict mode that is NOT in STRICT_EXTENSIONS
  it('C^invalid strict → parsed:false', () => {
    const r = parseChord('C^invalid');
    expect(r.parsed).toBe(false);
  });

  it('Cmajunknown strict → parsed:false', () => {
    const r = parseChord('Cmajunknown');
    expect(r.parsed).toBe(false);
  });

  // maj/^ prefix in relaxed mode
  it('C^invalid relaxed → parsed:true', () => {
    const r = parseChord('C^invalid', { mode: 'relaxed' });
    expect(r.parsed).toBe(true);
    expect(r.extension).toBe('^invalid');
  });

  it('Cmajweird relaxed → parsed:true', () => {
    const r = parseChord('Cmajweird', { mode: 'relaxed' });
    expect(r.parsed).toBe(true);
    expect(r.extension).toBe('majweird');
  });

  // aug/dim with unknown suffix in strict → qualifier-only failure
  it('Caugextra strict → parsed:false (no known dim+ext)', () => {
    const r = parseChord('Caugextra');
    // aug+extra not in STRICT_EXTENSIONS, strict → invalid
    expect(r.parsed).toBe(false);
  });

  it('Caugextra relaxed → parsed:true with qualifier', () => {
    const r = parseChord('Caugextra', { mode: 'relaxed' });
    expect(r.parsed).toBe(true);
    expect(r.qualifier).toBe('aug');
    expect(r.extension).toBe('extra');
  });
});

// ─── renderText — grid row, plain lyric, delegated ───────────────────────────

describe('renderText coverage gaps', () => {
  it('grid row rendered with | separators', () => {
    const src = '{sog}\nC | Am | F | G\n{eog}';
    const out = renderText(parse(src), { includeHeader: false });
    expect(out).toContain('|');
    expect(out).toContain('C');
    expect(out).toContain('Am');
  });

  it('plain lyric line (no chords) rendered as text', () => {
    const src = 'just a plain lyric line';
    const out = renderText(parse(src), { includeHeader: false });
    expect(out).toContain('just a plain lyric line');
  });

  it('delegated abc block rendered in renderText', () => {
    const src = '{start_of_abc}\nX:1\nT:Title\nK:G\n{end_of_abc}';
    const out = renderText(parse(src), { includeHeader: false });
    expect(out).toContain('X:1');
  });

  it('delegated section with empty rawContent', () => {
    const src = '{start_of_abc}\n{end_of_abc}';
    const out = renderText(parse(src), { includeHeader: false });
    expect(out).toBeDefined();
  });
});

// ─── parse.ts — custom end_of_* with no matching open ─────────────────────────

describe('parse.ts — custom end_of_* unmatched', () => {
  it('unmatched end_of_custom → warning + preserved as directive', () => {
    const song = parse('{end_of_custom_thing}');
    expect(song.warnings.some((w) => w.code === 'UNMATCHED_END')).toBe(true);
  });
});

// ─── parse.ts — unclosed delegated section ────────────────────────────────────

describe('parse.ts — unclosed delegated section', () => {
  it('unclosed abc section → warning + rawContent captured', () => {
    const src = '{start_of_abc}\nX:1\nK:G';
    const song = parse(src);
    expect(song.warnings.some((w) => w.code === 'UNCLOSED_SECTION')).toBe(true);
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      expect(section.delegated).toBe(true);
      expect(section.rawContent).toContain('X:1');
    }
  });
});

// ─── chordShapes — uncovered lines ───────────────────────────────────────────

describe('chordShapes coverage gaps', () => {
  it('getChordShape returns null for unknown chord on guitar', () => {
    expect(getChordShape('Xyz99', 'guitar')).toBeNull();
  });

  it('getChordShape returns null for unknown chord on ukulele', () => {
    expect(getChordShape('Xyz99', 'ukulele')).toBeNull();
  });

  it('getChordShape with song that has a define with fingers', () => {
    const src = '{define: TestChord base-fret 2 frets 1 2 3 4 fingers 1 2 3 4}';
    const song = parse(src);
    const shape = getChordShape('TestChord', 'guitar', song);
    expect(shape).not.toBeNull();
    expect(shape?.fingers).toBeDefined();
  });

  it('getChordShape with define that has no fingers', () => {
    const src = '{define: NoFingers base-fret 1 frets 0 1 2 3}';
    const song = parse(src);
    const shape = getChordShape('NoFingers', 'guitar', song);
    expect(shape).not.toBeNull();
    // fingers may be undefined
  });
});

// ─── renderText / renderHtml — missing section kinds ─────────────────────────

describe('renderText/renderHtml — all section kinds', () => {
  it('prechorus section renders with label', () => {
    const src = '{start_of_prechorus}\n[G]pre-chorus line\n{end_of_prechorus}';
    const text = renderText(parse(src), { includeHeader: false });
    expect(text).toContain('[Prechorus]');
  });

  it('custom section renders in HTML', () => {
    const src = '{start_of_intro}\n[G]intro\n{end_of_intro}';
    const html = renderHtml(parse(src), { includeHeader: false });
    expect(html).toContain('cp-section--custom');
  });

  it('chorus reference renders in renderText', () => {
    const src = '{chorus: My Chorus}';
    const text = renderText(parse(src), { includeHeader: false });
    expect(text).toContain('[Chorus]');
  });

  it('chorus reference with label renders in HTML', () => {
    const src = '{chorus: Refrain}';
    const html = renderHtml(parse(src), { includeHeader: false });
    expect(html).toContain('Refrain');
  });

  it('annotation renders in renderText output', () => {
    const text = renderText(parse('[*Coda]'), { includeHeader: false });
    expect(text).toContain('Coda');
  });
});

// ─── serialize.ts — edge cases ───────────────────────────────────────────────

describe('serialize — edge cases', () => {
  it('grid row without source falls back to cell reconstruction', () => {
    // A grid row with no source (created programmatically or after transposition)
    const song = parse('{sog}\nC | G\n{eog}');
    const section = song.lines.find((l) => l.type === 'section');
    if (section?.type === 'section') {
      const row = section.lines[0];
      if (row?.type === 'grid_row') {
        // Manually clear source to test fallback
        const rowWithoutSource = { ...row, source: undefined };
        const modified = {
          ...song,
          lines: song.lines.map((l) =>
            l.type === 'section'
              ? { ...l, lines: [rowWithoutSource] }
              : l,
          ),
        };
        const out = serialize(modified);
        expect(out).toContain('C');
        expect(out).toContain('G');
      }
    }
  });
});
