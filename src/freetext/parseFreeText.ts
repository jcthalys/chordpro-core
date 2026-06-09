/**
 * parseFreeText — Tier 2 auxiliary helper.
 * Converts loose human-written text to canonical ChordPro + extracted metadata.
 * NOT part of the ChordPro format.
 */

import { parseChord } from '../chords/parseChord.js';
import { guessKey } from '../analysis/guessKey.js';
import type { Warning } from '../model/types.js';

export interface ParseFreeTextResult {
  /** Canonical ChordPro output (re-parseable with zero warnings for well-formed input). */
  chordpro: string;
  /** Extracted metadata. */
  metadata: Map<string, string>;
  /** Non-fatal warnings from the conversion process. */
  warnings: Warning[];
}

// ─── Repeat-suffix helpers ─────────────────────────────────────────────────────

/** Matches repeat-count suffixes like (x2), (2x), (2 vezes), (repete 3), (repeat 2), (repetir 2). */
const REPEAT_SUFFIX_RE =
  /\s*\(\s*(?:x(\d+)|(\d+)x|(\d+)\s+vezes?|repete?\s+(\d+)(?:\s+vezes?)?|repeat\s+(\d+)|repetir\s+(\d+))\s*\)\s*$/i;

function extractRepeatSuffix(text: string): { text: string; count?: number } {
  const m = text.match(REPEAT_SUFFIX_RE);
  if (!m) return { text };
  const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? '1';
  const count = parseInt(raw, 10);
  return { text: text.slice(0, m.index!).trim(), count };
}

// ─── Section heading detection ────────────────────────────────────────────────

interface HeadingMatch {
  kind: 'chorus' | 'verse' | 'bridge' | 'prechorus';
  label?: string;
  repeatCount?: number;
}

function matchHeading(line: string): HeadingMatch | null {
  const trimmed = line.trim();

  // Strip repeat suffix (e.g. [Refrão] (x2) → text=[Refrão], count=2)
  const { text: withoutRepeat, count: repeatCount } = extractRepeatSuffix(trimmed);

  // Strip brackets: [Text] → Text
  const bracketMatch = withoutRepeat.match(/^\[([^\]]+)\]$/);
  const rawText = bracketMatch ? bracketMatch[1]!.trim() : withoutRepeat;
  const isBracketed = !!bracketMatch;

  // Strip optional trailing colon
  const text = rawText.endsWith(':') ? rawText.slice(0, -1).trim() : rawText;
  if (!text) return null;

  // Normalise compact "Word+digit" forms: "Verse1" → base="Verse", num="1".
  // \b fails between a letter and a digit (both are \w), so we split first and
  // test the base word, then reassemble the label with a space: "Verse 1".
  const compactNum = text.match(/^(.+?)\s*(\d+)$/);
  const base = compactNum ? compactNum[1]!.trimEnd() : text;
  const num = compactNum ? compactNum[2] : undefined;

  let kind: HeadingMatch['kind'] | null = null;

  // Pre-chorus — check before chorus to avoid "pre" swallowing "chorus"
  if (/^pr[eé][- ]?(?:refrão|refrao|coro)\b|^pr[eé][- ]?chorus\b/i.test(base)) {
    kind = 'prechorus';
  } else if (/^(?:chorus|coro|refr[aã]o)\b/i.test(base)) {
    kind = 'chorus';
  } else if (/^(?:verse|verso|estrofe)\b/i.test(base)) {
    kind = 'verse';
  } else if (/^(?:bridge|ponte)\b/i.test(base)) {
    kind = 'bridge';
  } else if (/^(?:intro|introdu[cç][aã]o|abertura)\b/i.test(base)) {
    kind = 'verse';
  } else if (/^(?:outro|final|finaliza[cç][aã]o|coda|tag)\b/i.test(base)) {
    kind = 'verse';
  } else if (/^(?:interl[uú]dio|solo|instrumental|riff)\b/i.test(base)) {
    kind = 'verse';
  }

  // For non-bracketed bare text, only match known heading keywords (prevents lyrics being
  // misidentified as headings). Bracketed text matches unconditionally when kind found above.
  if (!kind) return null;
  if (!isBracketed && kind === null) return null;

  // Chorus / pre-chorus labels carry no meaningful number — normalise to base only.
  // Verse, bridge, and other kinds keep the number: "Verse 1", "Bridge 2", etc.
  const labelBase = (kind === 'chorus' || kind === 'prechorus') ? base : base;
  const label = (kind === 'chorus' || kind === 'prechorus' || num === undefined)
    ? labelBase
    : `${labelBase} ${num}`;

  const result: HeadingMatch = { kind, label };
  if (repeatCount !== undefined) result.repeatCount = repeatCount;
  return result;
}

// ─── Metadata line detection ──────────────────────────────────────────────────

interface MetaEntry {
  /** Key used in the metadata Map. */
  mapKey: string;
  /** Value stored in metadata. */
  value: string;
}

/** Directives that emit as {name: value} directly. Others emit as {meta: name value}. */
const STANDARD_DIRECTIVES = new Set([
  'key', 'capo', 'tempo', 'time', 'ccli', 'artist', 'title',
  'album', 'year', 'composer', 'lyricist', 'copyright',
]);

function entry(mapKey: string, value: string): MetaEntry {
  return { mapKey, value };
}

function matchMetaLine(line: string): MetaEntry[] | null {
  const t = line.trim();
  let m: RegExpMatchArray | null;

  // ── Combined key+capo forms ────────────────────────────────────────────────
  // "Tom: A (Capo 2)" — key A, capo 2
  m = t.match(/^tom\s*:\s*(.+?)\s*\(\s*capo\s+(\d+)\s*\)\s*$/i);
  if (m) return [entry('key', m[1]!.trim()), entry('capo', m[2]!.trim())];

  // "Tom com Capo 2: G" → key G, capo 2
  m = t.match(/^tom\s+com\s+capo\s+(\d+)\s*:\s*(.+)$/i);
  if (m) return [entry('key', m[2]!.trim()), entry('capo', m[1]!.trim())];

  // "Tom (Capo 2): G" → key G, capo 2
  m = t.match(/^tom\s*\(\s*capo\s+(\d+)\s*\)\s*:\s*(.+)$/i);
  if (m) return [entry('key', m[2]!.trim()), entry('capo', m[1]!.trim())];

  // ── Single key/tuning lines ────────────────────────────────────────────────
  // "Tom real: X"
  m = t.match(/^tom\s+real\s*:\s*(.+)$/i);
  if (m) return [entry('tom_real', m[1]!.trim())];

  // "Tom: X"
  m = t.match(/^tom\s*:\s*(.+)$/i);
  if (m) return [entry('key', m[1]!.trim())];

  // "Key: X"
  m = t.match(/^key\s*:\s*(.+)$/i);
  if (m) return [entry('key', m[1]!.trim())];

  // "Capo: N" or "Capo N"
  m = t.match(/^capo\s*:?\s*(\d+)$/i);
  if (m) return [entry('capo', m[1]!.trim())];

  // "Capo: No capo" / "Capo: none" / "No capo" — UG format for no capo (= capo 0)
  // Return empty array: consume the line as metadata, emit no directive.
  m = t.match(/^(?:capo\s*:\s*)?no\s+capo$/i);
  if (m) return [];

  // "Tuning: E A D G B E" — UG standard-tuning annotation
  m = t.match(/^tuning\s*:\s*(.+)$/i);
  if (m) return [entry('tuning', m[1]!.trim())];

  // "Afinação: X" / "Afinacao: X"
  m = t.match(/^afina[cç][aã]o\s*:\s*(.+)$/i);
  if (m) return [entry('afinacao', m[1]!.trim())];

  // ── Tempo / rhythm ─────────────────────────────────────────────────────────
  // "BPM: N" / "Bpm: N"
  m = t.match(/^bpm\s*:\s*(\d+)$/i);
  if (m) return [entry('tempo', m[1]!.trim())];

  // "Tempo: X"
  m = t.match(/^tempo\s*:\s*(.+)$/i);
  if (m) return [entry('tempo', m[1]!.trim())];

  // "Andamento: X" — numeric → tempo, text → meta:andamento
  m = t.match(/^andamento\s*:\s*(.+)$/i);
  if (m) {
    const val = m[1]!.trim();
    return [entry(/^\d+$/.test(val) ? 'tempo' : 'andamento', val)];
  }

  // "Ritmo: X"
  m = t.match(/^ritmo\s*:\s*(.+)$/i);
  if (m) return [entry('ritmo', m[1]!.trim())];

  // "Fórmula de compasso: X" / "Compasso: X" — N/N → time directive, else meta
  m = t.match(/^(?:f[oó]rmula\s+de\s+)?compasso\s*:\s*(.+)$/i);
  if (m) {
    const val = m[1]!.trim();
    return [entry(/^\d+\/\d+$/.test(val) ? 'time' : 'compasso', val)];
  }

  // "Time: X"
  m = t.match(/^time\s*:\s*(.+)$/i);
  if (m) return [entry('time', m[1]!.trim())];

  // ── Standard metadata — Portuguese labels ──────────────────────────────────
  // "Artista: X"
  m = t.match(/^artista\s*:\s*(.+)$/i);
  if (m) return [entry('artist', m[1]!.trim())];

  // "Título: X" / "Titulo: X"
  m = t.match(/^t[ií]tulo\s*:\s*(.+)$/i);
  if (m) return [entry('title', m[1]!.trim())];

  // "Álbum: X" / "Album: X"
  m = t.match(/^[áa]lbum\s*:\s*(.+)$/i);
  if (m) return [entry('album', m[1]!.trim())];

  // "Compositor: X" / "Composição: X" / "Composicao: X"
  m = t.match(/^(?:compositor|composi[cç][aã]o)\s*:\s*(.+)$/i);
  if (m) return [entry('composer', m[1]!.trim())];

  // "Composer: X" (English)
  m = t.match(/^composer\s*:\s*(.+)$/i);
  if (m) return [entry('composer', m[1]!.trim())];

  // "Letrista: X"
  m = t.match(/^letrista\s*:\s*(.+)$/i);
  if (m) return [entry('lyricist', m[1]!.trim())];

  // "Lyricist: X" (English)
  m = t.match(/^lyricist\s*:\s*(.+)$/i);
  if (m) return [entry('lyricist', m[1]!.trim())];

  // "Ano: N"
  m = t.match(/^ano\s*:\s*(\d{3,4})$/i);
  if (m) return [entry('year', m[1]!.trim())];

  // "Year: N" (English)
  m = t.match(/^year\s*:\s*(\d{3,4})$/i);
  if (m) return [entry('year', m[1]!.trim())];

  // "CCLI: N"
  m = t.match(/^ccli\s*:\s*(.+)$/i);
  if (m) return [entry('ccli', m[1]!.trim())];

  // "Copyright: X"
  m = t.match(/^copyright\s*:\s*(.+)$/i);
  if (m) return [entry('copyright', m[1]!.trim())];

  return null;
}

/** Emit a MetaEntry as a ChordPro directive string (without surrounding {}). */
function directiveFor(e: MetaEntry): string {
  return STANDARD_DIRECTIVES.has(e.mapKey)
    ? `${e.mapKey}: ${e.value}`
    : `meta: ${e.mapKey} ${e.value}`;
}

// ─── Chord-only line detection ────────────────────────────────────────────────

/**
 * True if ≥80% of space-separated tokens are parseable chords (strict mode).
 * Strip trailing repeat markers before testing.
 */
function isChordOnlyLine(line: string): boolean {
  const { text } = extractRepeatSuffix(line.trim());
  const trimmed = text.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  let parsed = 0;
  for (const tok of tokens) {
    if (parseChord(tok, { mode: 'strict' }).parsed) parsed++;
  }
  return parsed / tokens.length >= 0.8;
}

// ─── Unicode-aware chord-above-lyrics merge ───────────────────────────────────

/**
 * Merge a chord-only line with the following lyrics line into inline ChordPro.
 * Uses code-point iteration for Unicode correctness (handles BMP and non-BMP chars).
 */
function mergeChordAboveLyrics(chordLine: string, lyricLine: string): string {
  // Code-point array of the lyric for Unicode-safe indexing
  const lyricCps = [...lyricLine];

  // Parse chord tokens with their code-point column positions
  const chordTokens: Array<{ col: number; name: string }> = [];
  const reChord = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = reChord.exec(chordLine)) !== null) {
    // m.index is a UTF-16 offset; convert to code-point count for Unicode safety
    const col = [...chordLine.slice(0, m.index)].length;
    chordTokens.push({ col, name: m[0]! });
  }

  if (chordTokens.length === 0) return lyricLine;

  let result = '';
  let lyricPos = 0;

  for (const token of chordTokens) {
    let insertAt = Math.min(token.col, lyricCps.length);
    // Snap forward to next non-space character (word boundary)
    while (insertAt < lyricCps.length && lyricCps[insertAt] === ' ') insertAt++;
    if (insertAt < lyricPos) insertAt = lyricPos;
    result += lyricCps.slice(lyricPos, insertAt).join('');
    lyricPos = insertAt;
    result += `[${token.name}]`;
  }

  result += lyricCps.slice(lyricPos).join('');
  return result;
}

// ─── Main function ────────────────────────────────────────────────────────────

/** Convert loosely-formatted human text to canonical ChordPro. */
export function parseFreeText(input: string): ParseFreeTextResult {
  const metadata = new Map<string, string>();
  const warnings: Warning[] = [];

  const rawLines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  type ProcessedLine =
    | { kind: 'title'; text: string }
    | { kind: 'artist'; text: string }
    | { kind: 'meta'; entries: MetaEntry[] }
    | { kind: 'heading'; match: HeadingMatch }
    | { kind: 'chord_only'; text: string; repeatCount?: number }
    | { kind: 'standalone_repeat'; count: number }
    | { kind: 'lyric'; text: string }
    | { kind: 'blank' }
    | { kind: 'directive'; text: string };

  const processedLines: ProcessedLine[] = [];
  let titleFound = false;
  let artistFound = false;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i] ?? '';
    const trimmed = raw.trim();

    if (!trimmed) {
      processedLines.push({ kind: 'blank' });
      continue;
    }

    // Passthrough ChordPro directives
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      processedLines.push({ kind: 'directive', text: trimmed });
      continue;
    }

    // Metadata line — test on the ORIGINAL trimmed line so compound forms like
    // "Tom: A (Capo 2)" are handled correctly before repeat-suffix stripping.
    const metaEntries = matchMetaLine(trimmed);
    if (metaEntries) {
      for (const e of metaEntries) metadata.set(e.mapKey, e.value);
      if (metaEntries.some((e) => e.mapKey === 'title')) titleFound = true;
      if (metaEntries.some((e) => e.mapKey === 'artist')) artistFound = true;
      processedLines.push({ kind: 'meta', entries: metaEntries });
      continue;
    }

    // Extract repeat suffix for heading / content classification
    const { text: withoutRepeat, count: repeatCount } = extractRepeatSuffix(trimmed);

    // Standalone repeat marker: whole line is "(x2)" etc.
    if (repeatCount !== undefined && !withoutRepeat) {
      processedLines.push({ kind: 'standalone_repeat', count: repeatCount });
      continue;
    }

    // Section heading — test on text-without-repeat (so "[Refrão] (x2)" → "[Refrão]")
    const headingInput = repeatCount !== undefined ? withoutRepeat : trimmed;
    const heading = matchHeading(headingInput);
    if (heading) {
      const match: HeadingMatch = { ...heading };
      if (repeatCount !== undefined && match.repeatCount === undefined) {
        match.repeatCount = repeatCount;
      }
      processedLines.push({ kind: 'heading', match });
      continue;
    }

    // Chord-only line (isChordOnlyLine strips repeat suffix internally)
    if (isChordOnlyLine(trimmed)) {
      const stripped = extractRepeatSuffix(trimmed);
      const chordEntry: Extract<ProcessedLine, { kind: 'chord_only' }> = { kind: 'chord_only', text: stripped.text };
      if (stripped.count !== undefined) chordEntry.repeatCount = stripped.count;
      processedLines.push(chordEntry);
      continue;
    }

    // Title / artist auto-detection from first two free-text lines
    if (!titleFound) {
      titleFound = true;
      metadata.set('title', trimmed);
      processedLines.push({ kind: 'title', text: trimmed });
      continue;
    }
    if (!artistFound) {
      artistFound = true;
      metadata.set('artist', trimmed);
      processedLines.push({ kind: 'artist', text: trimmed });
      continue;
    }

    processedLines.push({ kind: 'lyric', text: trimmed });
  }

  // ── Key auto-detection if no Key:/Tom: found ─────────────────────────────
  if (!metadata.has('key')) {
    const chordSource = processedLines
      .filter((pl): pl is { kind: 'chord_only'; text: string; repeatCount?: number } => pl.kind === 'chord_only')
      .flatMap((pl) => pl.text.split(/\s+/).filter(Boolean))
      .map((name) => `[${name}]`)
      .join(' ');
    if (chordSource.trim()) {
      const guess = guessKey(chordSource);
      if (guess && guess.confidence >= 0.5) {
        metadata.set('key', guess.key);
      }
    }
  }

  // ── Pass 2: emit ChordPro ─────────────────────────────────────────────────
  const outputLines: string[] = [];

  // Emit metadata directives at the top
  for (const [key, value] of metadata) {
    outputLines.push(`{${directiveFor({ mapKey: key, value })}}`);
  }

  let currentSection: string | null = null;

  function closeSection(): void {
    if (currentSection) {
      outputLines.push(`{end_of_${currentSection}}`);
      currentSection = null;
    }
  }

  function openSection(kind: string, label?: string): void {
    closeSection();
    const labelAttr = label ? ` label="${label}"` : '';
    outputLines.push(`{start_of_${kind}${labelAttr}}`);
    currentSection = kind;
  }

  let idx = 0;
  while (idx < processedLines.length) {
    const pl = processedLines[idx]!;

    switch (pl.kind) {
      case 'title':
      case 'artist':
      case 'meta':
        idx++;
        break;

      case 'blank':
        if (currentSection === null) outputLines.push('');
        idx++;
        break;

      case 'directive':
        outputLines.push(pl.text);
        idx++;
        break;

      case 'heading':
        openSection(pl.match.kind, pl.match.label);
        if (pl.match.repeatCount !== undefined) {
          outputLines.push(`{meta: repeat ${pl.match.repeatCount}}`);
        }
        idx++;
        break;

      case 'standalone_repeat':
        outputLines.push(`{comment: (x${pl.count})}`);
        idx++;
        break;

      case 'chord_only': {
        // Look ahead: if next non-blank is a lyric, merge
        let j = idx + 1;
        while (j < processedLines.length && processedLines[j]!.kind === 'blank') j++;
        const next = j < processedLines.length ? processedLines[j]! : null;

        if (next && next.kind === 'lyric') {
          const { text: lyricText, count: lyricRepeat } = extractRepeatSuffix(next.text);
          const merged = mergeChordAboveLyrics(pl.text, lyricText);
          const line = lyricRepeat !== undefined ? `${merged} [*x${lyricRepeat}]` : merged;
          outputLines.push(line);
          if (pl.repeatCount !== undefined) {
            outputLines.push(`{comment: (x${pl.repeatCount})}`);
          }
          idx = j + 1;
        } else {
          // Orphan chord line — bracket each chord token
          const chordLine = pl.text.split(/\s+/).filter(Boolean).map((c) => `[${c}]`).join(' ');
          outputLines.push(chordLine);
          if (pl.repeatCount !== undefined) {
            outputLines.push(`{comment: (x${pl.repeatCount})}`);
          }
          idx++;
        }
        break;
      }

      case 'lyric': {
        const { text: cleanText, count: rc } = extractRepeatSuffix(pl.text);
        outputLines.push(rc !== undefined ? `${cleanText} [*x${rc}]` : pl.text);
        idx++;
        break;
      }
    }
  }

  closeSection();

  return { chordpro: outputLines.join('\n'), metadata, warnings };
}
