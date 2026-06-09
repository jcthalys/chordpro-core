/**
 * Tier 2 — toInline / toAbove format converter tests.
 */

import { describe, it, expect } from 'vitest';
import { toInline, toAbove } from './format.js';
import { parse } from '../parser/parse.js';
import { serialize } from '../parser/serialize.js';
import type { LyricLine } from '../model/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkSong(src: string) {
  return parse(src);
}

/** Extract just the lyric text (no chords) from a serialized song. */
function lyricTextOnly(src: string): string {
  return src.replace(/\[[^\]]*\]/g, '');
}

/** Get the first lyric line in a song (skips non-lyric lines). */
function firstLyricLine(song: ReturnType<typeof parse>): LyricLine {
  const line = song.lines.find((l): l is LyricLine => l.type === 'lyric');
  if (!line) throw new Error('no lyric line found');
  return line;
}

// ─── toInline ────────────────────────────────────────────────────────────────

describe('toInline', () => {
  it('merges a chord-only line into the immediately following lyric line', () => {
    const song = mkSong('[G]       [C]\nAmazing grace');
    const result = toInline(song);
    const line = firstLyricLine(result);
    // G and C should now be inline
    expect(line.segments.find((s) => s.chord?.name === 'G')).toBeTruthy();
    expect(line.segments.find((s) => s.chord?.name === 'C')).toBeTruthy();
    // Single lyric line (no more chord-only line above)
    const lyricLines = result.lines.filter((l) => l.type === 'lyric');
    expect(lyricLines).toHaveLength(1);
  });

  it('places chords at correct column positions', () => {
    const above = mkSong('[G]       [C]\nAmazing grace');
    const inlined = toInline(above);
    const line = firstLyricLine(inlined);
    const g = line.segments.find((s) => s.chord?.name === 'G');
    const c = line.segments.find((s) => s.chord?.name === 'C');
    expect(g?.lyric).toBe('Amazing ');
    expect(c?.lyric).toBe('grace');
  });

  it('passes through a pure lyric line with no chords above it', () => {
    const song = mkSong('Hello world');
    const result = toInline(song);
    expect(serialize(result)).toBe(serialize(song));
  });

  it('passes through a line that already has inline chords', () => {
    const song = mkSong('[G]Amazing [C]grace');
    const result = toInline(song);
    expect(serialize(result)).toBe(serialize(song));
  });

  it('does not merge a chord-only line separated from the lyric by a blank line', () => {
    const song = mkSong('[G]   [C]\n\nAmazing grace');
    const result = toInline(song);
    // The blank line prevents merging; chord-only line stays as-is
    const lyricLines = result.lines.filter((l) => l.type === 'lyric');
    expect(lyricLines).toHaveLength(2);
  });

  it('recurses into section environments', () => {
    const song = mkSong(
      '{start_of_verse}\n[G]       [C]\nAmazing grace\n{end_of_verse}',
    );
    const result = toInline(song);
    const section = result.lines.find((l) => l.type === 'section');
    if (!section || section.type !== 'section') throw new Error();
    const lyricLines = section.lines.filter((l) => l.type === 'lyric');
    expect(lyricLines).toHaveLength(1);
    const line = lyricLines[0] as LyricLine;
    expect(line.segments.find((s) => s.chord?.name === 'G')).toBeTruthy();
  });

  it('passes through annotations unchanged (never merges annotation-only lines)', () => {
    // An annotation-only line is chord-only by definition; it should still merge
    // into the next lyric line (annotations are treated like chords positionally)
    const song = mkSong('[*Intro]   [*Fine]\nAmazing grace');
    const result = toInline(song);
    const lyricLines = result.lines.filter((l) => l.type === 'lyric');
    expect(lyricLines).toHaveLength(1);
    const line = lyricLines[0] as LyricLine;
    expect(line.segments.find((s) => s.annotation === 'Intro')).toBeTruthy();
    expect(line.segments.find((s) => s.annotation === 'Fine')).toBeTruthy();
  });

  it('passes through non-lyric lines (directives, blanks, comments)', () => {
    const song = mkSong('{title: Test}\n# comment\n\n[G]   [C]\nHello world');
    const result = toInline(song);
    const types = result.lines.map((l) => l.type);
    expect(types).toContain('directive');
    expect(types).toContain('comment');
    expect(types).toContain('blank');
  });

  it('handles leading lyric text before the first chord', () => {
    // Chord line: "      G     C"  (G at col 6)
    // Lyric line: "Hello world there"
    const song = mkSong('      [G]     [C]\nHello world there');
    const result = toInline(song);
    const line = firstLyricLine(result);
    const segs = line.segments;
    const gIdx = segs.findIndex((s) => s.chord?.name === 'G');
    // There should be a plain-lyric segment before G
    expect(gIdx).toBeGreaterThan(0);
    expect(segs[gIdx - 1]?.chord).toBeUndefined();
  });
});

// ─── toAbove ─────────────────────────────────────────────────────────────────

describe('toAbove', () => {
  it('splits an inline lyric line into chord-only + lyric-only', () => {
    const song = mkSong('[G]Amazing [C]grace');
    const result = toAbove(song);
    const lyricLines = result.lines.filter((l) => l.type === 'lyric');
    expect(lyricLines).toHaveLength(2);
  });

  it('chord-only line contains the chords, lyric-only line contains the text', () => {
    const song = mkSong('[G]Amazing [C]grace');
    const result = toAbove(song);
    const [chordLine, lyricLine] = result.lines.filter(
      (l): l is LyricLine => l.type === 'lyric',
    );
    // Chord line: every non-empty lyric is whitespace
    expect(chordLine?.segments.every((s) => s.lyric.trim() === '')).toBe(true);
    expect(chordLine?.segments.some((s) => s.chord?.name === 'G')).toBe(true);
    expect(chordLine?.segments.some((s) => s.chord?.name === 'C')).toBe(true);
    // Lyric line: no chords
    expect(lyricLine?.segments.every((s) => s.chord === undefined)).toBe(true);
    expect(lyricLine?.segments.map((s) => s.lyric).join('')).toBe('Amazing grace');
  });

  it('passes through a pure lyric line (no chords)', () => {
    const song = mkSong('Hello world');
    const result = toAbove(song);
    expect(serialize(result)).toBe(serialize(song));
    expect(result.lines.filter((l) => l.type === 'lyric')).toHaveLength(1);
  });

  it('passes through a chord-only line unchanged', () => {
    const song = mkSong('[G]       [C]');
    const result = toAbove(song);
    // Already chord-only — no split
    expect(result.lines.filter((l) => l.type === 'lyric')).toHaveLength(1);
  });

  it('preserves lyric text exactly (no padding added to lyric-only line)', () => {
    // Even when chord name is wider than the lyric, the lyric-only line is not padded
    const song = mkSong('[Cmaj7]A [Fmaj7]B');
    const result = toAbove(song);
    const [, lyricLine] = result.lines.filter((l): l is LyricLine => l.type === 'lyric');
    const text = lyricLine?.segments.map((s) => s.lyric).join('') ?? '';
    expect(text).toBe('A B');
  });

  it('chord column positions are correct (wider chord gets more spacing)', () => {
    const song = mkSong('[Cmaj7]Amazing [G]grace');
    const result = toAbove(song);
    const [chordLine] = result.lines.filter((l): l is LyricLine => l.type === 'lyric');
    // Cmaj7 is 5 chars; "Amazing " is 8 chars → colWidth = 8; spacing = 3 spaces
    const cmaj7seg = chordLine?.segments.find((s) => s.chord?.name === 'Cmaj7');
    expect(cmaj7seg?.lyric).toBe('   ');
  });

  it('recurses into section environments', () => {
    const song = mkSong(
      '{start_of_chorus}\n[G]Amazing [C]grace\n{end_of_chorus}',
    );
    const result = toAbove(song);
    const section = result.lines.find((l) => l.type === 'section');
    if (!section || section.type !== 'section') throw new Error();
    expect(section.lines.filter((l) => l.type === 'lyric')).toHaveLength(2);
  });

  it('passes through annotations as chord-line content', () => {
    const song = mkSong('[*Intro][G]Amazing [C]grace');
    const result = toAbove(song);
    const [chordLine] = result.lines.filter((l): l is LyricLine => l.type === 'lyric');
    expect(chordLine?.segments.some((s) => s.annotation === 'Intro')).toBe(true);
    expect(chordLine?.segments.some((s) => s.chord?.name === 'G')).toBe(true);
  });

  it('passes through non-lyric lines unchanged', () => {
    const song = mkSong('{key: G}\n# comment\n\n[G]Hello [C]world');
    const result = toAbove(song);
    const types = result.lines.map((l) => l.type);
    expect(types).toContain('directive');
    expect(types).toContain('comment');
    expect(types).toContain('blank');
  });
});

// ─── Round-trip and idempotency ───────────────────────────────────────────────

describe('round-trip', () => {
  const INLINE_SRC = `{title: Round-trip Test}
{key: G}

{start_of_verse label="Verse 1"}
[G]Amazing [C]grace, how [G]sweet the [D]sound
[G]That saved a [Em]wretch like [D]me
{end_of_verse}

{start_of_chorus}
[G]How great [C]is our [G]God
[D]Sing with [Em]me how [C]great is [G]our God
{end_of_chorus}`;

  it('toInline(toAbove(inlineSong)) preserves lyric text', () => {
    const song = mkSong(INLINE_SRC);
    const roundTripped = toInline(toAbove(song));
    const original = serialize(song);
    const rt = serialize(roundTripped);
    // Lyric content (no chords) must be identical
    expect(lyricTextOnly(rt)).toBe(lyricTextOnly(original));
  });

  it('toAbove(toInline(aboveSong)) preserves lyric text', () => {
    const song = mkSong(INLINE_SRC);
    const aboveSong = toAbove(song);
    const roundTripped = toAbove(toInline(aboveSong));
    const a = serialize(aboveSong);
    const rt = serialize(roundTripped);
    expect(lyricTextOnly(rt)).toBe(lyricTextOnly(a));
  });

  it('chord names are preserved through toAbove → toInline', () => {
    const song = mkSong('[G]Amazing [C]grace [D]how [Em]sweet');
    const rt = toInline(toAbove(song));
    const line = firstLyricLine(rt);
    const chordNames = line.segments
      .filter((s) => s.chord !== undefined)
      .map((s) => s.chord!.name);
    expect(chordNames).toEqual(['G', 'C', 'D', 'Em']);
  });
});

describe('idempotency', () => {
  const INLINE_SRC = '[G]Amazing [C]grace\n[D]How sweet [Em]the sound';
  const ABOVE_SRC = '[G]       [C]\nAmazing grace\n[D]         [Em]\nHow sweet the sound';

  it('toInline(toInline(song)) === toInline(song)', () => {
    const song = mkSong(ABOVE_SRC);
    const once = serialize(toInline(song));
    const twice = serialize(toInline(toInline(song)));
    expect(twice).toBe(once);
  });

  it('toAbove(toAbove(song)) === toAbove(song)', () => {
    const song = mkSong(INLINE_SRC);
    const once = serialize(toAbove(song));
    const twice = serialize(toAbove(toAbove(song)));
    expect(twice).toBe(once);
  });
});

describe('mixed content', () => {
  it('toInline only converts chord-only + lyric pairs, leaves pure lyrics alone', () => {
    // Line 1: chord-only (should merge with line 2)
    // Line 2: lyric-only (becomes merged inline)
    // Line 3: plain lyric, no chords (passes through)
    const song = mkSong('[G]   [C]\nHello world\nNo chords here');
    const result = toInline(song);
    const lyricLines = result.lines.filter((l): l is LyricLine => l.type === 'lyric');
    expect(lyricLines).toHaveLength(2);
    // First line should have inline chords
    expect(lyricLines[0]?.segments.some((s) => s.chord !== undefined)).toBe(true);
    // Second line should have no chords
    expect(lyricLines[1]?.segments.every((s) => s.chord === undefined)).toBe(true);
  });

  it('toAbove only converts inline lines, leaves chord-only lines alone', () => {
    // Mix: chord-only line, then inline line
    const song = mkSong('[G]   [C]\n[D]Hello [Em]world');
    const result = toAbove(song);
    // Chord-only line passes through (1 line)
    // Inline [D]Hello [Em]world splits into 2 lines
    expect(result.lines.filter((l) => l.type === 'lyric')).toHaveLength(3);
  });

  it('metadata and warnings are preserved unchanged', () => {
    const song = mkSong('{title: Test}\n{key: G}\n[G]Amazing [C]grace');
    const above = toAbove(song);
    const inline = toInline(above);
    expect(inline.metadata.get('title')).toBe('Test');
    expect(inline.metadata.get('key')).toBe('G');
  });
});
