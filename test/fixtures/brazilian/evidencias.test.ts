/**
 * Fixture test: complete Brazilian chord sheet (Evidências style).
 * Verifies all metadata, sections, repeat counts, and chord merging.
 * @tier tier2
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFreeText } from '../../../src/freetext/parseFreeText.js';
import { parse } from '../../../src/parser/parse.js';

const fixture = readFileSync(
  join(import.meta.dirname, 'evidencias.txt'),
  'utf8',
);

describe('Brazilian fixture: Evidências', () => {
  let chordpro: string;
  let metadata: Map<string, string>;

  beforeAll(() => {
    const result = parseFreeText(fixture);
    chordpro = result.chordpro;
    metadata = result.metadata;
  });

  // ── Metadata ──────────────────────────────────────────────────────────────
  it('extracts title', () => {
    expect(metadata.get('title')).toBe('Evidências');
  });

  it('extracts artist', () => {
    expect(metadata.get('artist')).toBe('Chitãozinho & Xororó');
  });

  it('extracts key A from combined Tom: A (Capo 2)', () => {
    expect(metadata.get('key')).toBe('A');
  });

  it('extracts capo 2 from combined Tom: A (Capo 2)', () => {
    expect(metadata.get('capo')).toBe('2');
  });

  it('extracts tempo 76 from BPM', () => {
    expect(metadata.get('tempo')).toBe('76');
  });

  it('extracts ritmo', () => {
    expect(metadata.get('ritmo')).toBe('Country Sertanejo');
  });

  // ── Directives in ChordPro output ─────────────────────────────────────────
  it('emits {key: A}', () => {
    expect(chordpro).toContain('{key: A}');
  });

  it('emits {capo: 2}', () => {
    expect(chordpro).toContain('{capo: 2}');
  });

  it('emits {tempo: 76}', () => {
    expect(chordpro).toContain('{tempo: 76}');
  });

  it('emits {meta: ritmo Country Sertanejo}', () => {
    expect(chordpro).toContain('{meta: ritmo Country Sertanejo}');
  });

  // ── Sections ──────────────────────────────────────────────────────────────
  it('has Intro section', () => {
    expect(chordpro).toContain('{start_of_verse label="Intro"}');
    expect(chordpro).toContain('{end_of_verse}');
  });

  it('has Verso 1 section', () => {
    expect(chordpro).toContain('{start_of_verse label="Verso 1"}');
  });

  it('has Pré-Refrão prechorus section', () => {
    expect(chordpro).toContain('{start_of_prechorus label="Pré-Refrão"}');
  });

  it('has Refrão chorus section', () => {
    expect(chordpro).toContain('{start_of_chorus label="Refrão"}');
  });

  it('has Ponte bridge section', () => {
    expect(chordpro).toContain('{start_of_bridge label="Ponte"}');
  });

  it('has Final verse section', () => {
    expect(chordpro).toContain('{start_of_verse label="Final"}');
  });

  // ── Repeat counts ─────────────────────────────────────────────────────────
  it('Intro chord line (x2) preserved as comment', () => {
    expect(chordpro).toContain('{comment: (x2)}');
  });

  it('[Refrão] (x2) → {meta: repeat 2} inside chorus section', () => {
    // The meta:repeat directive should appear after the start_of_chorus
    const chorusStart = chordpro.indexOf('{start_of_chorus');
    const repeatMeta = chordpro.indexOf('{meta: repeat 2}', chorusStart);
    expect(repeatMeta).toBeGreaterThan(chorusStart);
  });

  // ── Chord merging ─────────────────────────────────────────────────────────
  it('chord-above-lyrics merged into inline ChordPro (Verso 1)', () => {
    // G and D from chord line merged with "Eu sei que tu me amas"
    expect(chordpro).toContain('[G]');
    expect(chordpro).toContain('[D]');
    expect(chordpro).toContain('[Em]');
    expect(chordpro).toContain('[C]');
  });

  it('Intro chord-only line produces bracketed chords', () => {
    // [G] [D] [Em] [C] for the intro block
    const introStart = chordpro.indexOf('{start_of_verse label="Intro"}');
    const introEnd = chordpro.indexOf('{end_of_verse}', introStart);
    const introBlock = chordpro.slice(introStart, introEnd);
    expect(introBlock).toContain('[G]');
    expect(introBlock).toContain('[D]');
    expect(introBlock).toContain('[Em]');
    expect(introBlock).toContain('[C]');
  });

  // ── Re-parses cleanly ─────────────────────────────────────────────────────
  it('output re-parses with zero UNKNOWN_DIRECTIVE warnings', () => {
    const song = parse(chordpro);
    const unknowns = song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE');
    expect(unknowns).toHaveLength(0);
  });

  it('re-parsed song has correct title in metadata', () => {
    const song = parse(chordpro);
    expect(song.metadata.get('title')).toBe('Evidências');
  });

  it('re-parsed song has correct artist in metadata', () => {
    const song = parse(chordpro);
    expect(song.metadata.get('artist')).toBe('Chitãozinho & Xororó');
  });

  it('re-parsed song has ritmo in metadata', () => {
    const song = parse(chordpro);
    expect(song.metadata.get('ritmo')).toBe('Country Sertanejo');
  });
});
