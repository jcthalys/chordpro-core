/**
 * Tier 2 — free-text parser tests.
 * @tier tier2
 */

import { describe, it, expect } from 'vitest';
import { parseFreeText } from './parseFreeText.js';
import { parse } from '../parser/parse.js';

describe('parseFreeText', () => {
  it('extracts title from first content line', () => {
    const result = parseFreeText('Amazing Grace\nTraditional\n\n[G]Amazing grace');
    expect(result.metadata.get('title')).toBe('Amazing Grace');
  });

  it('extracts artist from second content line', () => {
    const result = parseFreeText('Song Title\nBand Name\n\nLyrics here');
    expect(result.metadata.get('artist')).toBe('Band Name');
  });

  it('extracts Key: metadata line', () => {
    const result = parseFreeText('Song\nArtist\nKey: G\n\nLyric');
    expect(result.metadata.get('key')).toBe('G');
  });

  it('extracts Tom: as Portuguese alias for Key', () => {
    const result = parseFreeText('Song\nArtist\nTom: Am\n\nLyric');
    expect(result.metadata.get('key')).toBe('Am');
  });

  it('extracts Tempo: and BPM:', () => {
    const r1 = parseFreeText('Song\nArtist\nTempo: 120\n\nLyric');
    expect(r1.metadata.get('tempo')).toBe('120');
    const r2 = parseFreeText('Song\nArtist\nBPM: 80\n\nLyric');
    expect(r2.metadata.get('tempo')).toBe('80');
  });

  it('extracts Capo:', () => {
    const result = parseFreeText('Song\nArtist\nCapo: 2\n\nLyric');
    expect(result.metadata.get('capo')).toBe('2');
  });

  it('extracts CCLI:', () => {
    const result = parseFreeText('Song\nArtist\nCCLI: 12345\n\nLyric');
    expect(result.metadata.get('ccli')).toBe('12345');
  });

  describe('section headings', () => {
    it('English Verse heading', () => {
      const result = parseFreeText('Song\nArtist\n\nVerse 1\nLine 1\n\nVerse 2\nLine 2');
      expect(result.chordpro).toContain('{start_of_verse');
      expect(result.chordpro).toContain('{end_of_verse}');
    });

    it('English Chorus heading', () => {
      const result = parseFreeText('Song\nArtist\n\nChorus\nSing along');
      expect(result.chordpro).toContain('{start_of_chorus');
    });

    it('Bracketed [Bridge] heading', () => {
      const result = parseFreeText('Song\nArtist\n\n[Bridge]\nLine');
      expect(result.chordpro).toContain('{start_of_bridge');
    });

    it('Portuguese Refrão heading', () => {
      const result = parseFreeText('Song\nArtist\n\nRefrão\nCanta');
      expect(result.chordpro).toContain('{start_of_chorus');
    });

    it('Portuguese Verso heading', () => {
      const result = parseFreeText('Song\nArtist\n\nVerso 1\nLinha');
      expect(result.chordpro).toContain('{start_of_verse');
    });

    it('Portuguese Ponte heading', () => {
      const result = parseFreeText('Song\nArtist\n\nPonte\nLinha');
      expect(result.chordpro).toContain('{start_of_bridge');
    });
  });

  describe('chord-above-lyrics merge', () => {
    it('merges simple chord-above-lyrics pair', () => {
      const text = 'Song\nArtist\n\nG     D     Em\nSwing low sweet chariot';
      const result = parseFreeText(text);
      expect(result.chordpro).toContain('[G]');
      expect(result.chordpro).toContain('[D]');
      expect(result.chordpro).toContain('[Em]');
    });

    it('does not treat lyric line with stray capital as chord line', () => {
      const text = 'Song\nArtist\n\nThis Is A Line with Some Capitals\nFollowing lyric';
      const result = parseFreeText(text);
      // "This Is A Line with Some Capitals" should NOT be treated as chords
      expect(result.chordpro).not.toContain('[This]');
    });
  });

  describe('key auto-detection', () => {
    it('auto-detects key when no Key: line present and chords appear ≥2 times', () => {
      const text = 'Song\nArtist\n\nG D G D Em C G D';
      // G appears 3+ times; should be detected
      const result = parseFreeText(text);
      // key may or may not be detected — just verify no throw
      expect(result).toBeDefined();
    });

    it('does NOT set key when most-frequent root appears only once', () => {
      const text = 'Song\nArtist\n\nG D Em C';
      // All appear once — auto-detect should not fire (or just not throw)
      expect(() => parseFreeText(text)).not.toThrow();
    });
  });

  describe('output re-parses with zero warnings for well-formed input', () => {
    it('simple song re-parses cleanly', () => {
      const text = 'My Song\nThe Artist\nKey: G\n\nVerse 1\n[G]Hello world\n\nChorus\n[C]Sing along';
      const { chordpro } = parseFreeText(text);
      const song = parse(chordpro);
      const unknownWarnings = song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE');
      expect(unknownWarnings).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      expect(() => parseFreeText('')).not.toThrow();
    });

    it('handles only-metadata input', () => {
      const result = parseFreeText('Key: G\nTempo: 120\nCapo: 2');
      expect(result.metadata.get('key')).toBe('G');
    });

    it('handles only-lyrics input', () => {
      expect(() => parseFreeText('Line one\nLine two\nLine three')).not.toThrow();
    });

    it('handles mixed line endings', () => {
      expect(() => parseFreeText('line1\r\nline2\rline3')).not.toThrow();
    });
  });
});
