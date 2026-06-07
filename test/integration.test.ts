/**
 * Integration tests using fixture files.
 * Exercises the full parse → serialize → reparse round-trip on real examples.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse, serialize, transpose, tokenize, parseFreeText, renderHtml, renderText } from '../src/index.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dir, 'fixtures');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('integration — amazing_grace.cho fixture', () => {
  const src = readFixture('amazing_grace.cho');

  it('parses without unknown-directive warnings', () => {
    const song = parse(src);
    const unknownWarnings = song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE');
    expect(unknownWarnings).toHaveLength(0);
  });

  it('extracts correct metadata', () => {
    const song = parse(src);
    expect(song.metadata.get('title')).toBe('Amazing Grace');
    expect(song.metadata.get('artist')).toBe('Traditional');
    expect(song.metadata.get('key')).toBe('G');
    expect(song.metadata.get('copyright')).toBe('Public Domain');
  });

  it('round-trips without content loss', () => {
    const song = parse(src);
    const out = serialize(song);
    // Preserve-only legacy directives
    expect(out).toContain('{textfont: Arial}');
    expect(out).toContain('{chordsize: 12}');
    expect(out).toContain('{new_page}');
    // Metadata
    expect(out).toContain('{title: Amazing Grace}');
    // Comments
    expect(out).toContain('# Verse 1');
    // Chord names
    expect(out).toContain('[G7]');
  });

  it('round-trip reparsed song has same chord count', () => {
    const song = parse(src);
    const song2 = parse(serialize(song));
    function countChords(s: typeof song): number {
      let n = 0;
      function walk(lines: typeof song.lines): void {
        for (const l of lines) {
          if (l.type === 'lyric') n += l.segments.filter((s) => s.chord).length;
          else if (l.type === 'section') walk(l.lines);
        }
      }
      walk(s.lines);
      return n;
    }
    expect(countChords(song2)).toBe(countChords(song));
  });

  it('transposes to A (up 2 semitones) correctly', () => {
    const song = parse(src);
    const transposed = transpose(song, 2);
    expect(transposed.metadata.get('key')).toBe('A');
    // G → A, G7 → A7, C → D, Em → F#m, D → E
    const out = serialize(transposed);
    expect(out).toContain('[A]');
    expect(out).toContain('[A7]');
    expect(out).toContain('[D]');
  });

  it('renderText includes title and section labels', () => {
    const song = parse(src);
    const text = renderText(song);
    expect(text).toContain('Amazing Grace');
    expect(text).toContain('[Chorus]');
  });

  it('renderHtml produces valid class-annotated HTML', () => {
    const song = parse(src);
    const html = renderHtml(song);
    expect(html).toContain('cp-song');
    expect(html).toContain('cp-title');
    expect(html).toContain('cp-section--chorus');
    expect(html).toContain('cp-section--verse');
    expect(html).not.toContain('style=');
  });

  it('tokenizer tiles source exactly', () => {
    const tokens = tokenize(src);
    const reconstructed = tokens.map((t) => t.text).join('');
    expect(reconstructed).toBe(src);
  });
});

describe('integration — freetext fixture', () => {
  const src = readFixture('freetext_sample.txt');

  it('converts to ChordPro that re-parses with no unknown-directive warnings', () => {
    const { chordpro } = parseFreeText(src);
    const song = parse(chordpro);
    expect(song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE')).toHaveLength(0);
  });

  it('extracts title and artist', () => {
    const { metadata } = parseFreeText(src);
    expect(metadata.get('title')).toBe('Amazing Grace');
    expect(metadata.get('artist')).toBe('Traditional');
  });

  it('extracts key from Key: line', () => {
    const { metadata } = parseFreeText(src);
    expect(metadata.get('key')).toBe('G');
  });

  it('detects verse and chorus sections', () => {
    const { chordpro } = parseFreeText(src);
    expect(chordpro).toContain('{start_of_verse');
    expect(chordpro).toContain('{start_of_chorus');
  });

  it('merges chord-above-lyrics', () => {
    const { chordpro } = parseFreeText(src);
    expect(chordpro).toContain('[G]');
    expect(chordpro).toContain('[G7]');
  });
});
