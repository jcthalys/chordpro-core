/**
 * Core ChordPro parser.
 * Implements the parse-and-preserve-everything policy.
 * Never throws; records Warning[]s and recovers.
 */

import type {
  Song,
  Line,
  BlankLine,
  CommentLine,
  LyricLine,
  SectionNode,
  ChorusReference,
  TabLine,
  GridRow,
  ChordDef,
  Warning,
  SectionKind,
} from '../model/types.js';
import { parseDirectiveBody } from './parseDirective.js';
import { segmentLine } from './segmenter.js';
import { parseGridRow } from './gridParser.js';
import {
  SECTION_OPEN_TO_KIND,
  SECTION_CLOSE_TO_KIND,
  DELEGATED_KINDS,
  METADATA_DIRECTIVES,
  TIER2_METADATA_MAP,
} from './directives.js';

export interface ParseOptions {
  /** 'strict' (default) or 'relaxed' chord parsing inside lyric lines. */
  chordMode?: 'strict' | 'relaxed';
  /** What to do with unknown directives. Default: 'warn'. */
  onUnknownDirective?: 'warn' | 'ignore';
}

/** Parse ChordPro source text into a Song AST. Never throws. */
export function parse(source: string, options: ParseOptions = {}): Song {
  const chordMode = options.chordMode ?? 'strict';
  const onUnknown = options.onUnknownDirective ?? 'warn';

  const metadata = new Map<string, string>();
  const lines: Line[] = [];
  const warnings: Warning[] = [];

  // Normalize line endings
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized === '') return { metadata, lines, warnings };
  const rawLines = normalized.split('\n');

  // Section stack for nesting
  type StackEntry = {
    section: SectionNode;
    rawLines: string[];
  };
  const stack: StackEntry[] = [];

  /** Emit a line to the current context (top of stack or root). */
  function emit(line: Line): void {
    if (stack.length > 0) {
      stack[stack.length - 1]!.section.lines.push(line);
    } else {
      lines.push(line);
    }
  }

  /** Emit to root regardless of stack. */
  function emitRoot(line: Line): void {
    lines.push(line);
  }

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i] ?? '';
    const lineNum = i + 1;

    // ── Blank line ──────────────────────────────────────────────────────────
    if (rawLine.trim() === '') {
      emit({ type: 'blank' } satisfies BlankLine);
      continue;
    }

    // ── Comment line ────────────────────────────────────────────────────────
    if (rawLine.trimStart().startsWith('#')) {
      emit({ type: 'comment', text: rawLine } satisfies CommentLine);
      continue;
    }

    // ── Directive line ───────────────────────────────────────────────────────
    const directiveMatch = rawLine.match(/^\s*\{([\s\S]*?)\}\s*$/);
    if (directiveMatch) {
      const body = (directiveMatch[1] ?? '').trim();
      const source = rawLine.trim();
      const { directive, warnings: dwarns } = parseDirectiveBody(body, source, lineNum);

      if (onUnknown === 'ignore') {
        // Filter unknown-directive warnings
        dwarns.filter((w) => w.code !== 'UNKNOWN_DIRECTIVE').forEach((w) => warnings.push(w));
      } else {
        dwarns.forEach((w) => warnings.push(w));
      }

      if (!directive) {
        // Malformed directive — emit as lyric (robustness)
        emit({ type: 'lyric', segments: [{ lyric: rawLine }] });
        continue;
      }

      const canonical = directive.name;

      // ── new_song: song boundary (reset; emit as directive for round-trip) ──
      if (canonical === 'new_song') {
        emit(directive);
        continue;
      }

      // ── Metadata directives ─────────────────────────────────────────────
      if (METADATA_DIRECTIVES.has(canonical) || TIER2_METADATA_MAP[canonical] !== undefined) {
        const metaKey = TIER2_METADATA_MAP[canonical] ?? canonical;
        const value = directive.argument?.trim() ?? '';

        if (canonical === 'meta') {
          // {meta: key value} — parse key and value from argument
          const [k, ...rest] = value.split(/\s+/);
          if (k) metadata.set(k, rest.join(' '));
        } else if (canonical === 'tag') {
          // {tag: value} — multi-valued; append
          const existing = metadata.get('tag');
          metadata.set('tag', existing ? `${existing}\n${value}` : value);
        } else {
          metadata.set(metaKey, value);
        }
        emit(directive);
        continue;
      }

      // ── chorus (standalone) → ChorusReference ───────────────────────────
      if (canonical === 'chorus' && !SECTION_OPEN_TO_KIND[canonical]) {
        // "chorus" with no argument is the standalone reference
        const ref: ChorusReference = { type: 'chorus_reference', source: directive.source };
        if (directive.argument) ref.label = directive.argument;
        emit(ref);
        continue;
      }

      // ── Section open ────────────────────────────────────────────────────
      const sectionKind = SECTION_OPEN_TO_KIND[canonical];
      if (sectionKind !== undefined) {
        const isDelegated = DELEGATED_KINDS.has(sectionKind);
        const section: SectionNode = {
          type: 'section',
          kind: sectionKind as SectionKind,
          lines: [],
          openSource: directive.source,
          closeSource: '',
          originalOpenName: directive.originalName,
          originalCloseName: '',
          attributes: directive.attributes,
          delegated: isDelegated,
        };
        const sectionLabel = directive.argument ?? directive.attributes['label'];
        if (sectionLabel) section.label = sectionLabel;
        stack.push({ section, rawLines: [] });
        continue;
      }

      // ── Custom start_of_* sections (not in the known table) ─────────────
      const customOpenMatch = canonical.match(/^start_of_(.+)$/);
      if (customOpenMatch && sectionKind === undefined) {
        const customKind = customOpenMatch[1]!;
        const section: SectionNode = {
          type: 'section',
          kind: 'custom',
          lines: [],
          openSource: directive.source,
          closeSource: '',
          originalOpenName: directive.originalName,
          originalCloseName: '',
          attributes: { ...directive.attributes, _customKind: customKind },
          delegated: false,
        };
        const sectionLabel = directive.argument ?? directive.attributes['label'];
        if (sectionLabel) section.label = sectionLabel;
        stack.push({ section, rawLines: [] });
        continue;
      }

      // ── Section close ────────────────────────────────────────────────────
      const closeKind = SECTION_CLOSE_TO_KIND[canonical];
      if (closeKind !== undefined) {
        // Pop from stack
        if (stack.length === 0) {
          warnings.push({
            line: lineNum,
            code: 'UNMATCHED_END',
            message: `Unexpected ${directive.originalName} with no matching open`,
          });
          emit(directive);
          continue;
        }

        const entry = stack.pop()!;
        entry.section.closeSource = directive.source;
        entry.section.originalCloseName = directive.originalName;

        // For delegated blocks, join raw lines as rawContent
        if (entry.section.delegated) {
          entry.section.rawContent = entry.rawLines.join('\n');
        }

        emit(entry.section);
        continue;
      }

      // ── Custom end_of_* sections ─────────────────────────────────────────
      const customCloseMatch = canonical.match(/^end_of_(.+)$/);
      if (customCloseMatch && closeKind === undefined) {
        if (stack.length > 0) {
          const entry = stack.pop()!;
          entry.section.closeSource = directive.source;
          entry.section.originalCloseName = directive.originalName;
          emit(entry.section);
        } else {
          warnings.push({
            line: lineNum,
            code: 'UNMATCHED_END',
            message: `Unexpected ${directive.originalName} with no matching open`,
          });
          emit(directive);
        }
        continue;
      }

      // ── Chord definitions → structured ChordDef node ────────────────────
      if (canonical === 'define' || canonical === 'chord') {
        emit(buildChordDef(directive));
        continue;
      }

      // ── All other directives ─────────────────────────────────────────────
      emit(directive);
      continue;
    }

    // ── Inside section context ───────────────────────────────────────────────
    if (stack.length > 0) {
      const entry = stack[stack.length - 1]!;

      // Delegated sections: preserve raw
      if (entry.section.delegated) {
        entry.rawLines.push(rawLine);
        continue;
      }

      // Tab sections: verbatim, no chord parsing
      if (entry.section.kind === 'tab') {
        const tabLine: TabLine = { type: 'tab_line', text: rawLine };
        entry.section.lines.push(tabLine);
        continue;
      }

      // Grid sections: parse grid rows
      if (entry.section.kind === 'grid') {
        const gridRow: GridRow = parseGridRow(rawLine);
        entry.section.lines.push(gridRow);
        continue;
      }
    }

    // ── Lyric line ────────────────────────────────────────────────────────
    const segments = segmentLine(rawLine, { chordMode });
    emit({ type: 'lyric', segments } satisfies LyricLine);
  }

  // Close any unclosed sections
  while (stack.length > 0) {
    const entry = stack.pop()!;
    warnings.push({
      line: rawLines.length,
      code: 'UNCLOSED_SECTION',
      message: `Unclosed section: ${entry.section.originalOpenName}`,
    });
    if (entry.section.delegated) {
      entry.section.rawContent = entry.rawLines.join('\n');
    }
    emitRoot(entry.section);
  }

  return { metadata, lines, warnings };
}

// ─── ChordDef builder ────────────────────────────────────────────────────────

import type { DirectiveLine } from '../model/types.js';

function buildChordDef(d: DirectiveLine): ChordDef {
  const arg = d.argument ?? '';
  const tokens = arg.trim().split(/\s+/);
  const name = tokens[0] ?? '';

  const def: ChordDef = {
    type: 'chord_def',
    name,
    originalName: d.originalName === 'chord' ? 'chord' : 'define',
    source: d.source,
  };

  // {define-guitar:} / {define-ukulele:} — instrument selector
  if (d.selector === 'guitar' || d.selector === 'ukulele') {
    def.instrument = d.selector;
  }

  const idx = (kw: string) => tokens.findIndex((t) => t.toLowerCase() === kw);

  // base-fret N
  const bfI = idx('base-fret');
  if (bfI >= 0) {
    const bf = parseInt(tokens[bfI + 1] ?? '', 10);
    if (!isNaN(bf)) def.baseFret = bf;
  }

  // frets f f f... (runs until next keyword or end)
  const frI = idx('frets');
  if (frI >= 0) {
    const nums = collectInts(tokens, frI + 1, ['fingers', 'keys']);
    if (nums.length) def.frets = nums;
  }

  // fingers f f f...
  const fnI = idx('fingers');
  if (fnI >= 0) {
    const nums = collectInts(tokens, fnI + 1, ['frets', 'keys']);
    if (nums.length) def.fingers = nums;
  }

  // keys N N N... (keyboard syntax)
  const kI = idx('keys');
  if (kI >= 0) {
    const nums = collectInts(tokens, kI + 1, ['frets', 'fingers']);
    if (nums.length) def.keys = nums;
  }

  // HTML-attribute-style extended params (already parsed by directive parser)
  const attrs = d.attributes;
  if (attrs['copy']) def.copy = attrs['copy'];
  if (attrs['copyall']) { def.copy = attrs['copyall']; def.copyAll = true; }
  if (attrs['display']) def.display = attrs['display'];

  return def;
}

function collectInts(tokens: string[], start: number, stopWords: string[]): number[] {
  const result: number[] = [];
  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (stopWords.includes(t.toLowerCase()) || t.includes('=') || t.includes('"')) break;
    const n = t === '-' || t.toLowerCase() === 'x' || t.toLowerCase() === 'n' ? -1 : parseInt(t, 10);
    if (!isNaN(n)) result.push(n);
  }
  return result;
}
