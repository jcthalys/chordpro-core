/**
 * Tier 1 — rendering tests.
 * @tier tier1
 */

import { describe, it, expect } from 'vitest';
import { renderText } from './renderText.js';
import { renderHtml } from './renderHtml.js';
import { parse } from '../parser/parse.js';

describe('renderText', () => {
  it('renders chords above lyrics in the correct columns', () => {
    const src = '[G]Swing [D]low, sweet [G]chari[D]ot';
    const song = parse(src);
    const out = renderText(song, { includeHeader: false });
    const lines = out.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const chordRow = lines[0]!;
    const lyricRow = lines[1]!;
    expect(chordRow).toContain('G');
    expect(chordRow).toContain('D');
    expect(lyricRow).toContain('Swing');
    expect(lyricRow).toContain('low,');
  });

  it('renders tab blocks verbatim', () => {
    const src = '{start_of_tab}\ne|--0--2--3--|\n{end_of_tab}';
    const song = parse(src);
    const out = renderText(song, { includeHeader: false });
    expect(out).toContain('e|--0--2--3--|');
  });

  it('renders comment directives as text', () => {
    const song = parse('{comment: This is a note}');
    const out = renderText(song, { includeHeader: false });
    expect(out).toContain('This is a note');
  });

  it('renders chorus reference', () => {
    const song = parse('{chorus}');
    const out = renderText(song, { includeHeader: false });
    expect(out).toContain('[Chorus]');
  });

  it('includes header when requested', () => {
    const song = parse('{title: My Song}\n{artist: Me}\n{key: G}');
    const out = renderText(song);
    expect(out).toContain('My Song');
    expect(out).toContain('Me');
    expect(out).toContain('Key: G');
  });
});

describe('renderHtml', () => {
  it('wraps output in .cp-song', () => {
    const song = parse('{title: Test}');
    const out = renderHtml(song);
    expect(out).toContain('class="cp-song"');
  });

  it('emits .cp-title for title', () => {
    const song = parse('{title: My Song}');
    const out = renderHtml(song);
    expect(out).toContain('cp-title');
    expect(out).toContain('My Song');
  });

  it('emits .cp-chord for inline chords', () => {
    const song = parse('[G]word');
    const out = renderHtml(song, { includeHeader: false });
    expect(out).toContain('cp-chord');
    expect(out).toContain('>G<');
  });

  it('emits .cp-annotation for annotations', () => {
    const song = parse('[*Coda]');
    const out = renderHtml(song, { includeHeader: false });
    expect(out).toContain('cp-annotation');
  });

  it('emits .cp-section--chorus for chorus', () => {
    const src = '{soc}\n[G]Sing\n{eoc}';
    const song = parse(src);
    const out = renderHtml(song, { includeHeader: false });
    expect(out).toContain('cp-section--chorus');
  });

  it('emits .cp-tab for tab blocks', () => {
    const src = '{start_of_tab}\ne|---|\n{end_of_tab}';
    const song = parse(src);
    const out = renderHtml(song, { includeHeader: false });
    expect(out).toContain('cp-tab');
  });

  it('escapes HTML special characters', () => {
    const song = parse('[G]word & <em>');
    const out = renderHtml(song, { includeHeader: false });
    expect(out).toContain('&amp;');
    expect(out).toContain('&lt;');
  });

  it('emits no inline style or color', () => {
    const song = parse('[G]word');
    const out = renderHtml(song, { includeHeader: false });
    expect(out).not.toContain('style=');
    expect(out).not.toContain('color:');
  });
});
