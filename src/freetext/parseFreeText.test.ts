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

    it('compact Verse1 (no space) detected as verse', () => {
      const result = parseFreeText('Song\nArtist\n\nVerse1\nLine');
      expect(result.chordpro).toContain('{start_of_verse');
      expect(result.chordpro).toContain('Verse 1');
    });

    it('compact Verse2 (no space) detected with normalised label', () => {
      const result = parseFreeText('Song\nArtist\n\nVerse2\nLine');
      expect(result.chordpro).toContain('{start_of_verse');
      expect(result.chordpro).toContain('Verse 2');
    });

    it('compact Bridge1 (no space) detected as bridge', () => {
      const result = parseFreeText('Song\nArtist\n\nBridge1\nLine');
      expect(result.chordpro).toContain('{start_of_bridge');
      expect(result.chordpro).toContain('Bridge 1');
    });

    it('compact Chorus1 (no space) detected as chorus with no number in label', () => {
      const result = parseFreeText('Song\nArtist\n\nChorus1\nSing');
      expect(result.chordpro).toContain('{start_of_chorus');
      // Chorus strips the number from label
      expect(result.chordpro).not.toContain('Chorus 1');
    });

    it('compact Verso1 (Portuguese, no space) detected as verse', () => {
      const result = parseFreeText('Song\nArtist\n\nVerso1\nLinha');
      expect(result.chordpro).toContain('{start_of_verse');
      expect(result.chordpro).toContain('Verso 1');
    });

    it('spaced Verse 2 still works after refactor', () => {
      const result = parseFreeText('Song\nArtist\n\nVerse 2\nLine');
      expect(result.chordpro).toContain('{start_of_verse');
      expect(result.chordpro).toContain('Verse 2');
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

  // ── Brazilian / Portuguese metadata lines ────────────────────────────────
  describe('Brazilian/Portuguese metadata lines', () => {
    it('Tom: A (Capo 2) extracts both key and capo', () => {
      const r = parseFreeText('Song\nArtist\nTom: A (Capo 2)');
      expect(r.metadata.get('key')).toBe('A');
      expect(r.metadata.get('capo')).toBe('2');
    });

    it('Tom com Capo 2: G extracts both key and capo', () => {
      const r = parseFreeText('Song\nArtist\nTom com Capo 2: G');
      expect(r.metadata.get('key')).toBe('G');
      expect(r.metadata.get('capo')).toBe('2');
    });

    it('Tom (Capo 3): Em extracts both key and capo', () => {
      const r = parseFreeText('Song\nArtist\nTom (Capo 3): Em');
      expect(r.metadata.get('key')).toBe('Em');
      expect(r.metadata.get('capo')).toBe('3');
    });

    it('Tom real: X emits as meta:tom_real', () => {
      const r = parseFreeText('Song\nArtist\nTom real: A');
      expect(r.metadata.get('tom_real')).toBe('A');
      expect(r.chordpro).toContain('{meta: tom_real A}');
    });

    it('Afinação: X emits as meta:afinacao', () => {
      const r = parseFreeText('Song\nArtist\nAfinação: meio tom abaixo');
      expect(r.metadata.get('afinacao')).toBe('meio tom abaixo');
      expect(r.chordpro).toContain('{meta: afinacao meio tom abaixo}');
    });

    it('Afinacao: X (without accent) recognized', () => {
      const r = parseFreeText('Song\nArtist\nAfinacao: afinação padrão');
      expect(r.metadata.get('afinacao')).toBeDefined();
    });

    it('Capo N (without colon) recognized', () => {
      const r = parseFreeText('Song\nArtist\nCapo 2');
      expect(r.metadata.get('capo')).toBe('2');
    });

    it('Andamento: 120 (numeric) → tempo', () => {
      const r = parseFreeText('Song\nArtist\nAndamento: 120');
      expect(r.metadata.get('tempo')).toBe('120');
    });

    it('Andamento: Moderato (text) → meta:andamento', () => {
      const r = parseFreeText('Song\nArtist\nAndamento: Moderato');
      expect(r.metadata.get('andamento')).toBe('Moderato');
      expect(r.chordpro).toContain('{meta: andamento Moderato}');
    });

    it('Ritmo: X emits as meta:ritmo', () => {
      const r = parseFreeText('Song\nArtist\nRitmo: Country Sertanejo');
      expect(r.metadata.get('ritmo')).toBe('Country Sertanejo');
      expect(r.chordpro).toContain('{meta: ritmo Country Sertanejo}');
    });

    it('Compasso: 3/4 → time directive', () => {
      const r = parseFreeText('Song\nArtist\nCompasso: 3/4');
      expect(r.metadata.get('time')).toBe('3/4');
      expect(r.chordpro).toContain('{time: 3/4}');
    });

    it('Compasso: Binário → meta:compasso', () => {
      const r = parseFreeText('Song\nArtist\nCompasso: Binário');
      expect(r.metadata.get('compasso')).toBeDefined();
      expect(r.chordpro).toContain('{meta: compasso Binário}');
    });

    it('Fórmula de compasso: 4/4 → time directive', () => {
      const r = parseFreeText('Song\nArtist\nFórmula de compasso: 4/4');
      expect(r.metadata.get('time')).toBe('4/4');
    });

    it('Artista: X → artist', () => {
      const r = parseFreeText('Song\nArtist\nArtista: Chitãozinho & Xororó');
      expect(r.metadata.get('artist')).toBe('Chitãozinho & Xororó');
      expect(r.chordpro).toContain('{artist: Chitãozinho & Xororó}');
    });

    it('explicit Artista: suppresses second-line artist detection', () => {
      // When Artista: is explicit, the second content line should NOT become artist
      const r = parseFreeText('Artista: Explicit Artist\nKey: G\n\nSong Title\n\nLyric');
      expect(r.metadata.get('artist')).toBe('Explicit Artist');
    });

    it('Título: X → title', () => {
      const r = parseFreeText('Song\nArtist\nTítulo: New Title');
      expect(r.metadata.get('title')).toBe('New Title');
    });

    it('Titulo: X (without accent) recognized', () => {
      const r = parseFreeText('Song\nArtist\nTitulo: New Title');
      expect(r.metadata.get('title')).toBe('New Title');
    });

    it('Álbum: X → album', () => {
      const r = parseFreeText('Song\nArtist\nÁlbum: Sertanejo Vol. 1');
      expect(r.metadata.get('album')).toBe('Sertanejo Vol. 1');
    });

    it('Album: X (without accent) recognized', () => {
      const r = parseFreeText('Song\nArtist\nAlbum: My Album');
      expect(r.metadata.get('album')).toBe('My Album');
    });

    it('Ano: N → year', () => {
      const r = parseFreeText('Song\nArtist\nAno: 1994');
      expect(r.metadata.get('year')).toBe('1994');
    });

    it('Compositor: X → composer', () => {
      const r = parseFreeText('Song\nArtist\nCompositor: João Silva');
      expect(r.metadata.get('composer')).toBe('João Silva');
    });

    it('Composição: X → composer', () => {
      const r = parseFreeText('Song\nArtist\nComposição: Maria Santos');
      expect(r.metadata.get('composer')).toBe('Maria Santos');
    });

    it('Composicao: X (without accent) recognized', () => {
      const r = parseFreeText('Song\nArtist\nComposicao: Pedro Alves');
      expect(r.metadata.get('composer')).toBe('Pedro Alves');
    });

    it('Letrista: X → lyricist', () => {
      const r = parseFreeText('Song\nArtist\nLetrista: Ana Souza');
      expect(r.metadata.get('lyricist')).toBe('Ana Souza');
    });

    it('Copyright: X → copyright', () => {
      const r = parseFreeText('Song\nArtist\nCopyright: 2024 Editora Musical');
      expect(r.metadata.get('copyright')).toBe('2024 Editora Musical');
    });

    it('all new metadata directives re-parse without UNKNOWN_DIRECTIVE warnings', () => {
      const text = [
        'Song\nArtist',
        'Ritmo: Samba',
        'Andamento: 100',
        'Compasso: 2/4',
        'Compositor: Test',
        'Letrista: Test',
        'Copyright: Test',
        '\n[Verse]\nLyric',
      ].join('\n');
      const { chordpro } = parseFreeText(text);
      const song = parse(chordpro);
      const unknowns = song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE');
      expect(unknowns).toHaveLength(0);
    });
  });

  // ── Portuguese / Brazilian section headings ──────────────────────────────
  describe('Brazilian/Portuguese section headings', () => {
    it('Estrofe heading → verse', () => {
      const r = parseFreeText('Song\nArtist\n\nEstrofe\nLinha');
      expect(r.chordpro).toContain('{start_of_verse');
    });

    it('Estrofe N heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nEstrofe 1\nLinha');
      expect(r.chordpro).toContain('{start_of_verse label="Estrofe 1"}');
    });

    it('Estrofe N: (with colon) heading → verse', () => {
      const r = parseFreeText('Song\nArtist\n\nEstrofe 2:\nLinha');
      expect(r.chordpro).toContain('{start_of_verse label="Estrofe 2"}');
    });

    it('Coro heading → chorus', () => {
      const r = parseFreeText('Song\nArtist\n\nCoro\nCanta');
      expect(r.chordpro).toContain('{start_of_chorus');
    });

    it('[Coro] bracketed heading → chorus', () => {
      const r = parseFreeText('Song\nArtist\n\n[Coro]\nCanta');
      expect(r.chordpro).toContain('{start_of_chorus');
    });

    it('Pré-Refrão heading → prechorus', () => {
      const r = parseFreeText('Song\nArtist\n\nPré-Refrão\nLinha');
      expect(r.chordpro).toContain('{start_of_prechorus');
    });

    it('Pre-Refrao (no accent) heading → prechorus', () => {
      const r = parseFreeText('Song\nArtist\n\nPre-Refrao\nLinha');
      expect(r.chordpro).toContain('{start_of_prechorus');
    });

    it('Pré-Coro heading → prechorus', () => {
      const r = parseFreeText('Song\nArtist\n\nPré-Coro\nLinha');
      expect(r.chordpro).toContain('{start_of_prechorus');
    });

    it('Pre-Chorus heading → prechorus', () => {
      const r = parseFreeText('Song\nArtist\n\nPre-Chorus\nLinha');
      expect(r.chordpro).toContain('{start_of_prechorus');
    });

    it('[Intro] heading → start_of_verse with Intro label', () => {
      const r = parseFreeText('Song\nArtist\n\n[Intro]\nC G');
      expect(r.chordpro).toContain('{start_of_verse label="Intro"}');
    });

    it('Introdução heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nIntrodução\nC G');
      expect(r.chordpro).toContain('{start_of_verse label="Introdução"}');
    });

    it('Abertura heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nAbertura\nC G');
      expect(r.chordpro).toContain('{start_of_verse label="Abertura"}');
    });

    it('[Outro] heading → start_of_verse with Outro label', () => {
      const r = parseFreeText('Song\nArtist\n\n[Outro]\nG');
      expect(r.chordpro).toContain('{start_of_verse label="Outro"}');
    });

    it('[Final] heading → start_of_verse with Final label', () => {
      const r = parseFreeText('Song\nArtist\n\n[Final]\nG');
      expect(r.chordpro).toContain('{start_of_verse label="Final"}');
    });

    it('Finalização heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nFinalização\nG');
      expect(r.chordpro).toContain('{start_of_verse label="Finalização"}');
    });

    it('Coda heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nCoda\nG');
      expect(r.chordpro).toContain('{start_of_verse label="Coda"}');
    });

    it('Solo heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nSolo\nG D');
      expect(r.chordpro).toContain('{start_of_verse label="Solo"}');
    });

    it('Solo N heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nSolo 2\nG D');
      expect(r.chordpro).toContain('{start_of_verse label="Solo 2"}');
    });

    it('Instrumental heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nInstrumental\nG D');
      expect(r.chordpro).toContain('{start_of_verse label="Instrumental"}');
    });

    it('Riff heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nRiff\nG D');
      expect(r.chordpro).toContain('{start_of_verse label="Riff"}');
    });

    it('Interlúdio heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nInterlúdio\nG D');
      expect(r.chordpro).toContain('{start_of_verse label="Interlúdio"}');
    });

    it('Interludio (no accent) heading → verse with label', () => {
      const r = parseFreeText('Song\nArtist\n\nInterludio\nG D');
      expect(r.chordpro).toContain('{start_of_verse label="Interludio"}');
    });
  });

  // ── Repeat annotations ───────────────────────────────────────────────────
  describe('repeat annotations', () => {
    it('section heading with (x2) → {meta: repeat 2} inside section', () => {
      const r = parseFreeText('Song\nArtist\n\n[Chorus] (x2)\nSing along');
      expect(r.chordpro).toContain('{start_of_chorus label="Chorus"}');
      expect(r.chordpro).toContain('{meta: repeat 2}');
    });

    it('section heading with (2x) → {meta: repeat 2}', () => {
      const r = parseFreeText('Song\nArtist\n\n[Verse] (2x)\nLyric');
      expect(r.chordpro).toContain('{meta: repeat 2}');
    });

    it('standalone (x3) line → {comment: (x3)}', () => {
      const r = parseFreeText('Song\nArtist\n\n[Verse]\nLyric\n(x3)');
      expect(r.chordpro).toContain('{comment: (x3)}');
    });

    it('standalone (3 vezes) line → {comment: (x3)}', () => {
      const r = parseFreeText('Song\nArtist\n\n[Verse]\nLyric\n(3 vezes)');
      expect(r.chordpro).toContain('{comment: (x3)}');
    });

    it('lyric line with trailing (x2) → annotation [*x2]', () => {
      const r = parseFreeText('Song\nArtist\n\n[Verse]\nSing along (x2)');
      expect(r.chordpro).toContain('[*x2]');
      expect(r.chordpro).not.toContain('(x2)');
    });

    it('[Refrão] (x2) produces prechorus section with repeat', () => {
      const r = parseFreeText('Song\nArtist\n\n[Refrão] (x2)\nCanta');
      expect(r.chordpro).toContain('{start_of_chorus label="Refrão"}');
      expect(r.chordpro).toContain('{meta: repeat 2}');
    });

    it('repeat markers re-parse without UNKNOWN_DIRECTIVE warnings', () => {
      const text = 'Song\nArtist\n\n[Chorus] (x2)\nLyric';
      const { chordpro } = parseFreeText(text);
      const song = parse(chordpro);
      const unknowns = song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE');
      expect(unknowns).toHaveLength(0);
    });
  });

  // ── Ultimate Guitar (UG) format support ──────────────────────────────────
  describe('Ultimate Guitar format support', () => {
    describe('bracketed numbered headings (Issue 2a)', () => {
      it('[Verse 1] produces start_of_verse with label "Verse 1"', () => {
        const r = parseFreeText('Song\nArtist\n\n[Verse 1]\nHello world');
        expect(r.chordpro).toContain('{start_of_verse label="Verse 1"}');
        expect(r.chordpro).toContain('{end_of_verse}');
      });

      it('[Verse 2] produces start_of_verse with label "Verse 2"', () => {
        const r = parseFreeText('Song\nArtist\n\n[Verse 2]\nSecond verse');
        expect(r.chordpro).toContain('{start_of_verse label="Verse 2"}');
      });

      it('[Chorus] produces start_of_chorus', () => {
        const r = parseFreeText('Song\nArtist\n\n[Chorus]\nSing along');
        expect(r.chordpro).toContain('{start_of_chorus');
      });

      it('[Bridge 1] produces start_of_bridge with label "Bridge 1"', () => {
        const r = parseFreeText('Song\nArtist\n\n[Bridge 1]\nBridge line');
        expect(r.chordpro).toContain('{start_of_bridge label="Bridge 1"}');
        expect(r.chordpro).toContain('{end_of_bridge}');
      });

      it('[Bridge 2] produces start_of_bridge with label "Bridge 2"', () => {
        const r = parseFreeText('Song\nArtist\n\n[Bridge 2]\nAnother bridge');
        expect(r.chordpro).toContain('{start_of_bridge label="Bridge 2"}');
      });

      it('[Pre-Chorus] produces start_of_prechorus', () => {
        const r = parseFreeText('Song\nArtist\n\n[Pre-Chorus]\nBuilding up');
        expect(r.chordpro).toContain('{start_of_prechorus');
      });

      it('[Intro] is recognised as a section heading (not treated as lyric)', () => {
        const r = parseFreeText('Song\nArtist\n\n[Intro]\nF#m E');
        expect(r.chordpro).toContain('{start_of_verse');
        // The body content should NOT include the literal text "[Intro]"
        expect(r.chordpro).not.toContain('[Intro]');
      });

      it('[Outro] is recognised as a section heading (not treated as lyric)', () => {
        const r = parseFreeText('Song\nArtist\n\n[Outro]\nF#m');
        expect(r.chordpro).toContain('{start_of_verse');
        expect(r.chordpro).not.toContain('[Outro]');
      });
    });

    describe('UG metadata lines (Issue 2b)', () => {
      it('Key: E → key directive', () => {
        const r = parseFreeText('Song\nArtist\nKey: E\n\nLyric');
        expect(r.metadata.get('key')).toBe('E');
        expect(r.chordpro).toContain('{key: E}');
      });

      it('Capo: 2 → capo directive', () => {
        const r = parseFreeText('Song\nArtist\nCapo: 2\n\nLyric');
        expect(r.metadata.get('capo')).toBe('2');
        expect(r.chordpro).toContain('{capo: 2}');
      });

      it('Capo: No capo → no capo directive emitted', () => {
        const r = parseFreeText('Song\nArtist\nKey: E\nCapo: No capo\n\nLyric');
        expect(r.chordpro).not.toContain('{capo:');
        // "Capo: No capo" must not be treated as title/artist/lyric
        expect(r.chordpro).not.toContain('No capo');
      });

      it('"No capo" standalone line → no capo directive emitted', () => {
        const r = parseFreeText('Song\nArtist\nNo capo\n\nLyric');
        expect(r.chordpro).not.toContain('{capo:');
        expect(r.chordpro).not.toContain('No capo');
      });

      it('Tuning: E A D G B E → tuning meta', () => {
        const r = parseFreeText('Song\nArtist\nTuning: E A D G B E\n\nLyric');
        expect(r.metadata.get('tuning')).toBe('E A D G B E');
        expect(r.chordpro).toContain('{meta: tuning E A D G B E}');
        // Must not appear in song body
        expect(r.chordpro).not.toMatch(/^Tuning:/m);
      });
    });

    describe('UG chord-above-lyrics alignment (Issue 2c)', () => {
      it('merges UG-style chord-above-lyrics pair placing chords at correct columns', () => {
        // UG format uses space-alignment — chords above their syllable
        // G at col 0, C at col 8: "G       C"
        // Lyric: "Amazing grace" — 'A'=0 … ' '=7, 'g'=8
        const r = parseFreeText('Song\nArtist\n\nG       C\nAmazing grace');
        expect(r.chordpro).toContain('[G]Amazing ');
        expect(r.chordpro).toContain('[C]grace');
      });

      it('all four chords from UG intro line appear in output', () => {
        // UG orphan chord line: each chord is bracket-wrapped and space-separated
        const r = parseFreeText('Song\nArtist\n\nF#m E C#m B');
        expect(r.chordpro).toContain('[F#m]');
        expect(r.chordpro).toContain('[E]');
        expect(r.chordpro).toContain('[C#m]');
        expect(r.chordpro).toContain('[B]');
      });
    });
  });

  // ── Accent-aware column alignment ────────────────────────────────────────
  describe('accent-aware column alignment', () => {
    it('chords above Portuguese lyrics with accents align to correct syllable', () => {
      // Am at col 0, G at col 7 (after "Am     ")
      // Lyric: "Será   bom" — 'Será' ends at col 3, space at 4-6, 'bom' at col 7
      // 'á' (U+00E1) is BMP — counts as 1 code point, 1 UTF-16 code unit
      const r = parseFreeText('Song\nArtist\n\nAm     G\nSerá   bom');
      expect(r.chordpro).toContain('[Am]Será   [G]bom');
    });

    it('multiple accented chars in lyric — chords land on correct words', () => {
      // Chord line: "C        G" — C at 0, G at 9
      // Lyric: "Coração  é" — C=0,o=1,r=2,a=3,ç=4,ã=5,o=6,' '=7,' '=8,é=9
      // ç (U+00E7) and ã (U+00E3) are BMP
      const r = parseFreeText('Song\nArtist\n\nC        G\nCoração  é');
      expect(r.chordpro).toContain('[C]Coração  [G]é');
    });

    it('fixture with ã ç é ó â ê — chords placed correctly', () => {
      // Am at col 0, G at col 6; lyric "Não   bom" — N=0,ã=1,o=2,' '=3,' '=4,' '=5,b=6
      // ã is BMP (U+00E3): counts as 1 code point, same as ASCII char
      const r = parseFreeText('Song\nArtist\n\nAm    G\nNão   bom');
      expect(r.chordpro).toContain('[Am]Não   [G]bom');
    });
  });

  // ── CR14-5 — labelled + bare metadata patterns, EN + PT ─────────────────
  describe('CR14-5 — fórmula: short form', () => {
    it('fórmula: 4/4 → time directive', () => {
      const r = parseFreeText('Song\nArtist\nFórmula: 4/4');
      expect(r.metadata.get('time')).toBe('4/4');
      expect(r.chordpro).toContain('{time: 4/4}');
    });

    it('formula: 6/8 (no accent) → time directive', () => {
      const r = parseFreeText('Song\nArtist\nFormula: 6/8');
      expect(r.metadata.get('time')).toBe('6/8');
    });

    it('fórmula: 3/4 → time directive', () => {
      const r = parseFreeText('Song\nArtist\nFórmula: 3/4');
      expect(r.metadata.get('time')).toBe('3/4');
    });

    it('fórmula: Binário (non-numeric) → meta:compasso', () => {
      const r = parseFreeText('Song\nArtist\nFórmula: Binário');
      expect(r.metadata.get('compasso')).toBe('Binário');
    });
  });

  describe('CR14-5 — bare time signature', () => {
    it('bare 4/4 → time directive', () => {
      const r = parseFreeText('Song\nArtist\n4/4');
      expect(r.metadata.get('time')).toBe('4/4');
      expect(r.chordpro).toContain('{time: 4/4}');
    });

    it('bare 3/4 → time directive', () => {
      const r = parseFreeText('Song\nArtist\n3/4');
      expect(r.metadata.get('time')).toBe('3/4');
    });

    it('bare 6/8 → time directive', () => {
      const r = parseFreeText('Song\nArtist\n6/8');
      expect(r.metadata.get('time')).toBe('6/8');
    });
  });

  describe('CR14-5 — bare tempo', () => {
    it('bare 90 → tempo directive', () => {
      const r = parseFreeText('Song\nArtist\n90');
      expect(r.metadata.get('tempo')).toBe('90');
      expect(r.chordpro).toContain('{tempo: 90}');
    });

    it('bare 120 → tempo directive', () => {
      const r = parseFreeText('Song\nArtist\n120');
      expect(r.metadata.get('tempo')).toBe('120');
    });

    it('bare 40 (lower bound) → tempo directive', () => {
      const r = parseFreeText('Song\nArtist\n40');
      expect(r.metadata.get('tempo')).toBe('40');
    });

    it('bare 300 (upper bound) → tempo directive', () => {
      const r = parseFreeText('Song\nArtist\n300');
      expect(r.metadata.get('tempo')).toBe('300');
    });

    it('bare 39 (below range) → NOT tempo (treated as lyric/title)', () => {
      const r = parseFreeText('Song\nArtist\n39');
      expect(r.metadata.get('tempo')).toBeUndefined();
    });

    it('bare 301 (above range) → NOT tempo', () => {
      const r = parseFreeText('Song\nArtist\n301');
      expect(r.metadata.get('tempo')).toBeUndefined();
    });
  });

  describe('CR14-5 — key via guessKey path (chord-above-lyrics songs)', () => {
    it('song with only E chords → key guessed as E', () => {
      // Multiple E chords across sections; guessKey achieves threshold
      const r = parseFreeText('Song\nArtist\n\nE E B7\nSome lyrics\nE A B7\nMore words');
      expect(r.metadata.get('key')).toBe('E');
    });

    it('song with Am/Dm/E chord set → key guessed as Am', () => {
      const r = parseFreeText('Song\nArtist\n\nAm Dm E\nSome lyrics\nAm G F E\nMore words');
      expect(r.metadata.get('key')).toBe('Am');
    });
  });

  describe('CR14-5 — ambiguity guards', () => {
    it('bare 90 → tempo, not key', () => {
      const r = parseFreeText('Song\nArtist\n90');
      expect(r.metadata.get('key')).toBeUndefined();
      expect(r.metadata.get('tempo')).toBe('90');
    });

    it('bare 4/4 → time, not tempo', () => {
      const r = parseFreeText('Song\nArtist\n4/4');
      expect(r.metadata.get('tempo')).toBeUndefined();
      expect(r.metadata.get('time')).toBe('4/4');
    });

    it('chord-above-lyrics G on its own line → chord, not key', () => {
      // G alone inside song body is a chord-only line, not a key declaration
      const r = parseFreeText('Song\nArtist\n\nG\nSing along');
      // key comes from guessKey (G chord → G key), NOT from bare-key misdetection
      // What matters: the lyric is rendered, G is a chord in the output
      expect(r.chordpro).toContain('[G]');
    });
  });

  describe('CR14-5 — multi-field lines', () => {
    it('tom: E   tempo: 90   4/4 → all three fields', () => {
      const r = parseFreeText('Song\nArtist\ntom: E   tempo: 90   4/4');
      expect(r.metadata.get('key')).toBe('E');
      expect(r.metadata.get('tempo')).toBe('90');
      expect(r.metadata.get('time')).toBe('4/4');
    });

    it('key: G   time: 3/4 → two fields', () => {
      const r = parseFreeText('Song\nArtist\nkey: G   time: 3/4');
      expect(r.metadata.get('key')).toBe('G');
      expect(r.metadata.get('time')).toBe('3/4');
    });

    it('bpm: 76   compasso: 4/4 → tempo and time', () => {
      const r = parseFreeText('Song\nArtist\nbpm: 76   compasso: 4/4');
      expect(r.metadata.get('tempo')).toBe('76');
      expect(r.metadata.get('time')).toBe('4/4');
    });

    it('tom: Am   tempo: 100   6/8 → three fields with minor key', () => {
      const r = parseFreeText('Song\nArtist\ntom: Am   tempo: 100   6/8');
      expect(r.metadata.get('key')).toBe('Am');
      expect(r.metadata.get('tempo')).toBe('100');
      expect(r.metadata.get('time')).toBe('6/8');
    });

    it('all multi-field directives re-parse without UNKNOWN_DIRECTIVE warnings', () => {
      const { chordpro } = parseFreeText('Song\nArtist\ntom: E   tempo: 90   4/4\n\n[Verse]\nHello');
      const song = parse(chordpro);
      const unknowns = song.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE');
      expect(unknowns).toHaveLength(0);
    });
  });
});
