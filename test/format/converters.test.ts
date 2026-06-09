/**
 * Tests for the three format converters: toSimpleText, toDirectiveText, toRawText.
 */

import { describe, it, expect } from 'vitest';
import { toSimpleText, toDirectiveText, toRawText } from '../../src/format/converters.js';
import { parse } from '../../src/parser/parse.js';
import { serialize } from '../../src/parser/serialize.js';
import { parseFreeText } from '../../src/freetext/parseFreeText.js';
import type { SectionNode } from '../../src/model/types.js';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const SAMPLE = `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{capo: 2}
{start_of_verse label="Verse 1"}
[G]Amazing [C]grace, how [G]sweet the [D]sound
[G]That saved a [Em]wretch like [D]me
{end_of_verse}
{start_of_chorus}
[G]How great [C]is our [G]God
{end_of_chorus}`;

function parseSong(src: string) {
  return parse(src);
}

function sections(song: ReturnType<typeof parse>): SectionNode[] {
  return song.lines.filter((l): l is SectionNode => l.type === 'section');
}

// ─── toSimpleText ─────────────────────────────────────────────────────────────

describe('toSimpleText', () => {
  // ── Metadata ─────────────────────────────────────────────────────────────────

  it('emits title as bare line (no label)', () => {
    const song = parseSong(SAMPLE);
    const lines = toSimpleText(song).split('\n');
    expect(lines[0]).toBe('Amazing Grace');
  });

  it('emits artist as bare line (no label)', () => {
    const song = parseSong(SAMPLE);
    const lines = toSimpleText(song).split('\n');
    expect(lines[1]).toBe('John Newton');
  });

  it('emits key with "Key:" label', () => {
    const song = parseSong(SAMPLE);
    expect(toSimpleText(song)).toContain('Key: G');
  });

  it('emits capo with "Capo:" label', () => {
    const song = parseSong(SAMPLE);
    expect(toSimpleText(song)).toContain('Capo: 2');
  });

  it('emits tempo with "BPM:" label', () => {
    const song = parseSong('{title: T}\n{tempo: 120}');
    expect(toSimpleText(song)).toContain('BPM: 120');
  });

  it('{bpm:} alias normalises to tempo and emits "BPM:" label', () => {
    const song = parseSong('{title: T}\n{bpm: 95}');
    expect(toSimpleText(song)).toContain('BPM: 95');
  });

  it('{capo: 0} is omitted — no-capo is the default and need not be shown', () => {
    const song = parseSong('{title: T}\n{capo: 0}');
    expect(toSimpleText(song)).not.toContain('Capo:');
  });

  it('emits time with "Time:" label', () => {
    const song = parseSong('{title: T}\n{time: 3/4}');
    expect(toSimpleText(song)).toContain('Time: 3/4');
  });

  it('emits album with "Album:" label', () => {
    const song = parseSong('{title: T}\n{album: Hymns}');
    expect(toSimpleText(song)).toContain('Album: Hymns');
  });

  it('emits year with "Year:" label', () => {
    const song = parseSong('{title: T}\n{year: 1779}');
    expect(toSimpleText(song)).toContain('Year: 1779');
  });

  it('emits copyright with "Copyright:" label', () => {
    const song = parseSong('{title: T}\n{copyright: Public Domain}');
    expect(toSimpleText(song)).toContain('Copyright: Public Domain');
  });

  it('emits ccli with "CCLI:" label', () => {
    const song = parseSong('{title: T}\n{ccli: 12345}');
    expect(toSimpleText(song)).toContain('CCLI: 12345');
  });

  it('emits composer with "Composer:" label', () => {
    const song = parseSong('{title: T}\n{composer: J.S. Bach}');
    expect(toSimpleText(song)).toContain('Composer: J.S. Bach');
  });

  it('emits lyricist with "Lyricist:" label', () => {
    const song = parseSong('{title: T}\n{lyricist: John Newton}');
    expect(toSimpleText(song)).toContain('Lyricist: John Newton');
  });

  it('emits {meta: K V} pairs as "K: V"', () => {
    const song = parseSong('{title: T}\n{meta: ritmo Baião}');
    expect(toSimpleText(song)).toContain('ritmo: Baião');
  });

  it('metadata block ends with a blank line before body', () => {
    const song = parseSong('{title: Test}\n[G]Hello');
    const text = toSimpleText(song, { chords: 'inline' });
    expect(text).toBe('Test\n\n[G]Hello');
  });

  it('no metadata block when song has no metadata', () => {
    const song = parseSong('[G]Hello');
    const text = toSimpleText(song, { chords: 'inline' });
    expect(text).toBe('[G]Hello');
  });

  // ── Sections ─────────────────────────────────────────────────────────────────

  it('emits labeled verse heading as plain text', () => {
    const song = parseSong(SAMPLE);
    expect(toSimpleText(song)).toContain('Verse 1');
  });

  it('emits unlabeled chorus as "Chorus"', () => {
    const song = parseSong(SAMPLE);
    expect(toSimpleText(song)).toContain('Chorus');
  });

  it('emits unlabeled bridge as "Bridge"', () => {
    const song = parseSong('{start_of_bridge}\n[G]Hello\n{end_of_bridge}');
    expect(toSimpleText(song)).toContain('Bridge');
  });

  it('emits prechorus as "Pre-Chorus" for round-trip compatibility', () => {
    const song = parseSong('{start_of_prechorus}\n[G]Before\n{end_of_prechorus}');
    expect(toSimpleText(song)).toContain('Pre-Chorus');
  });

  it('sections separated by blank lines', () => {
    const song = parseSong(SAMPLE);
    const text = toSimpleText(song);
    // A blank line must appear between the verse content and the chorus heading
    expect(text).toMatch(/me\n\nChorus/);
  });

  // ── Chords — above mode (default) ─────────────────────────────────────────────

  it('chord-only lines have no brackets in above mode', () => {
    const song = parseSong('[G]Amazing [C]grace');
    const text = toSimpleText(song); // default 'above'
    expect(text).not.toMatch(/\[G\]/);
    expect(text).toMatch(/\bG\b/);
  });

  it('lyric-only lines are plain text in above mode', () => {
    const song = parseSong('[G]Amazing [C]grace');
    const text = toSimpleText(song);
    expect(text).toContain('Amazing grace');
  });

  // ── Chords — inline mode ───────────────────────────────────────────────────────

  it('inline mode emits [G]word format', () => {
    const song = parseSong('[G]Amazing [C]grace');
    const text = toSimpleText(song, { chords: 'inline' });
    expect(text).toContain('[G]Amazing');
    expect(text).toContain('[C]grace');
  });

  // ── Directive stripping ────────────────────────────────────────────────────────

  it('omits directive syntax from body', () => {
    const song = parseSong(SAMPLE);
    const text = toSimpleText(song);
    expect(text).not.toContain('{');
    expect(text).not.toContain('}');
  });

  it('comment directives become # lines', () => {
    const song = parseSong('[G]Hello\n{comment: strum pattern}');
    const text = toSimpleText(song, { chords: 'inline' });
    expect(text).toContain('# strum pattern');
  });

  // ── Round-trip via parseFreeText ───────────────────────────────────────────────

  it('round-trip: parseFreeText(toSimpleText(song)) restores title', () => {
    const song = parseSong(SAMPLE);
    const { metadata } = parseFreeText(toSimpleText(song));
    expect(metadata.get('title')).toBe('Amazing Grace');
  });

  it('round-trip: parseFreeText(toSimpleText(song)) restores artist', () => {
    const song = parseSong(SAMPLE);
    const { metadata } = parseFreeText(toSimpleText(song));
    expect(metadata.get('artist')).toBe('John Newton');
  });

  it('round-trip: parseFreeText(toSimpleText(song)) restores key', () => {
    const song = parseSong(SAMPLE);
    const { metadata } = parseFreeText(toSimpleText(song));
    expect(metadata.get('key')).toBe('G');
  });

  it('round-trip: parseFreeText(toSimpleText(song)) restores capo', () => {
    const song = parseSong(SAMPLE);
    const { metadata } = parseFreeText(toSimpleText(song));
    expect(metadata.get('capo')).toBe('2');
  });

  it('round-trip: parseFreeText restores composer (English label)', () => {
    const song = parseSong('{title: Test}\n{composer: J.S. Bach}');
    const { metadata } = parseFreeText(toSimpleText(song));
    expect(metadata.get('composer')).toBe('J.S. Bach');
  });

  it('round-trip: parseFreeText restores lyricist (English label)', () => {
    const song = parseSong('{title: Test}\n{lyricist: John Newton}');
    const { metadata } = parseFreeText(toSimpleText(song));
    expect(metadata.get('lyricist')).toBe('John Newton');
  });

  it('round-trip: parseFreeText restores year (English label)', () => {
    const song = parseSong('{title: Test}\n{year: 1779}');
    const { metadata } = parseFreeText(toSimpleText(song));
    expect(metadata.get('year')).toBe('1779');
  });

  it('round-trip: section kinds are preserved (verse + chorus)', () => {
    const song = parseSong(SAMPLE);
    const { chordpro } = parseFreeText(toSimpleText(song));
    const rt = parse(chordpro);
    const kinds = sections(rt).map((s) => s.kind);
    expect(kinds).toContain('verse');
    expect(kinds).toContain('chorus');
  });

  it('round-trip: labeled verse section label is preserved', () => {
    const song = parseSong(SAMPLE);
    const { chordpro } = parseFreeText(toSimpleText(song));
    const rt = parse(chordpro);
    const verse = sections(rt).find((s) => s.kind === 'verse');
    expect(verse?.label).toBe('Verse 1');
  });

  it('round-trip: prechorus kind is preserved', () => {
    const song = parseSong('{start_of_prechorus}\n[G]Before\n{end_of_prechorus}');
    const { chordpro } = parseFreeText(toSimpleText(song));
    const rt = parse(chordpro);
    const kinds = sections(rt).map((s) => s.kind);
    expect(kinds).toContain('prechorus');
  });

  // ── Blank line accumulation guard ─────────────────────────────────────────────
  // Regression: each round-trip through Simple mode was accumulating an extra blank
  // line between the metadata block and the first section because renderBodySimple
  // could emit a leading blank (from a blank line in the source ChordPro between
  // directives and the first section), which was then prepended to the separator
  // blank already added by the metadata block.  The fix strips leading blanks from
  // the body before joining.

  it('exactly one blank line between metadata and body — no accumulation on repeated round-trips', () => {
    // Source ChordPro has a blank line between the last directive and the first section.
    // This blank appears in song.lines as a BlankLine and was causing double-blank output.
    const src = '{title: Amazing Grace}\n{key: G}\n{capo: 3}\n\n{start_of_verse: Intro}\nG Bm Em D\n{end_of_verse}';
    let text = toSimpleText(parseSong(src));

    function blanksBefore(t: string): number {
      // Count consecutive blank lines between the last metadata line and first section heading.
      const lines = t.split('\n');
      const lastMetaIdx = lines.findLastIndex((l) => /^(Key|Capo|BPM|Time):/.test(l) || (lines.indexOf(l) < 3 && l.trim().length > 0));
      let count = 0;
      for (let i = lastMetaIdx + 1; i < lines.length; i++) {
        if (lines[i] === '') count++;
        else break;
      }
      return count;
    }

    // After first toSimpleText: exactly 1 blank
    expect(blanksBefore(text)).toBe(1);

    // Round-trip 1: simple → parse → simple
    text = toSimpleText(parse(parseFreeText(text).chordpro));
    expect(blanksBefore(text)).toBe(1);

    // Round-trip 2: still exactly 1 — no accumulation
    text = toSimpleText(parse(parseFreeText(text).chordpro));
    expect(blanksBefore(text)).toBe(1);

    // Round-trip 3
    text = toSimpleText(parse(parseFreeText(text).chordpro));
    expect(blanksBefore(text)).toBe(1);
  });

  it('source ChordPro with blank before first section still produces exactly one separator blank', () => {
    // Blank line between last metadata directive and {start_of_verse} is a common pattern.
    const src = '{title: T}\n{key: G}\n\n{start_of_verse}\n[G]Hello\n{end_of_verse}';
    const text = toSimpleText(parseSong(src));
    const lines = text.split('\n');
    // "T", "Key: G", "", "Verse", "[G]Hello" — exactly one blank between meta and body
    expect(lines[0]).toBe('T');
    expect(lines[1]).toBe('Key: G');
    expect(lines[2]).toBe('');
    expect(lines[3]).not.toBe(''); // no double blank
  });
});

// ─── toDirectiveText ──────────────────────────────────────────────────────────

describe('toDirectiveText', () => {
  it('produces ChordPro directive syntax', () => {
    const song = parseSong(SAMPLE);
    const text = toDirectiveText(song);
    expect(text).toContain('{title:');
    expect(text).toContain('{start_of_verse');
    expect(text).toContain('{end_of_verse}');
    expect(text).toContain('{start_of_chorus}');
    expect(text).toContain('{end_of_chorus}');
  });

  it('inline mode produces same output as serialize()', () => {
    const song = parseSong(SAMPLE);
    expect(toDirectiveText(song, { chords: 'inline' })).toBe(serialize(song));
  });

  it('above mode lifts chords in output', () => {
    const song = parseSong('[G]Amazing [C]grace');
    const text = toDirectiveText(song); // default 'above'
    // Chord-only line serialized with brackets in ChordPro format
    expect(text).toContain('[G]');
    const lines = text.split('\n');
    // Two lines expected: chord-only + lyric-only
    expect(lines).toHaveLength(2);
  });

  it('inline chord mode passes chords through without splitting', () => {
    const song = parseSong('[G]Amazing [C]grace');
    const text = toDirectiveText(song, { chords: 'inline' });
    expect(text.split('\n')).toHaveLength(1);
    expect(text).toContain('[G]Amazing');
  });

  it('preserves metadata directives', () => {
    const song = parseSong(SAMPLE);
    const text = toDirectiveText(song);
    expect(text).toContain('{artist: John Newton}');
    expect(text).toContain('{key: G}');
  });
});

// ─── toRawText ────────────────────────────────────────────────────────────────

describe('toRawText', () => {
  it('inline mode produces same output as serialize()', () => {
    const song = parseSong(SAMPLE);
    expect(toRawText(song, { chords: 'inline' })).toBe(serialize(song));
  });

  it('default (above) applies toAbove before serializing', () => {
    const song = parseSong('[G]Amazing [C]grace');
    const text = toRawText(song); // default 'above'
    const lines = text.split('\n');
    // Two lines: chord-only + lyric-only
    expect(lines).toHaveLength(2);
  });

  it('preserves all directives including section environments', () => {
    const song = parseSong(SAMPLE);
    const text = toRawText(song, { chords: 'inline' });
    expect(text).toContain('{title:');
    expect(text).toContain('{start_of_verse');
    expect(text).toContain('{end_of_chorus}');
  });

  it('does not throw for a song with no content', () => {
    const song = parseSong('');
    expect(() => toRawText(song)).not.toThrow();
  });

  it('toDirectiveText and toRawText produce identical output (same semantics)', () => {
    const song = parseSong(SAMPLE);
    expect(toRawText(song, { chords: 'inline' })).toBe(
      toDirectiveText(song, { chords: 'inline' }),
    );
    expect(toRawText(song)).toBe(toDirectiveText(song));
  });
});

// ─── parseFreeText English patterns (round-trip guarantors) ───────────────────

describe('parseFreeText English metadata patterns', () => {
  it('recognizes "Composer: X"', () => {
    const { metadata } = parseFreeText('My Song\nComposer: J.S. Bach');
    expect(metadata.get('composer')).toBe('J.S. Bach');
  });

  it('recognizes "Lyricist: X"', () => {
    const { metadata } = parseFreeText('My Song\nLyricist: John Newton');
    expect(metadata.get('lyricist')).toBe('John Newton');
  });

  it('recognizes "Year: N"', () => {
    const { metadata } = parseFreeText('My Song\nYear: 1779');
    expect(metadata.get('year')).toBe('1779');
  });

  it('Composer: does not conflict with Portuguese "Compositor:"', () => {
    const { metadata: pt } = parseFreeText('My Song\nCompositor: J.S. Bach');
    expect(pt.get('composer')).toBe('J.S. Bach');
    const { metadata: en } = parseFreeText('My Song\nComposer: J.S. Bach');
    expect(en.get('composer')).toBe('J.S. Bach');
  });
});
