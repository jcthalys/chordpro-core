/**
 * tokenize — Tier 2 auxiliary helper.
 * Returns typed tokens for editor syntax highlighting.
 * Offsets exactly tile the source — concatenating text reproduces the input.
 * Pure and fast; suitable to call on a debounce.
 *
 * @remarks
 * This is an auxiliary helper, not part of the ChordPro format specification.
 */

import { METADATA_DIRECTIVES, KNOWN_DIRECTIVES, normalizeName } from '../parser/directives.js';
import type { DirectiveCategory } from '../parser/directives.js';

export type { DirectiveCategory };

/** Lookup from canonical directive name → category, built once at module load. */
const DIRECTIVE_CATEGORY_MAP: ReadonlyMap<string, DirectiveCategory> = new Map(
  KNOWN_DIRECTIVES.map((d) => [d.name, d.category]),
);

export interface Token {
  type:
    | 'metadata-directive'
    | 'section-open'
    | 'section-end'
    | 'directive'
    | 'chord'
    | 'annotation'
    | 'comment'
    | 'lyric';
  /** Exact source slice. */
  text: string;
  /** Byte offset in source (inclusive). */
  start: number;
  /** Byte offset in source (exclusive). */
  end: number;
  /**
   * Directive category from the known-directive registry.
   * Present only on directive-type tokens (`metadata-directive`, `section-open`,
   * `section-end`, `directive`) whose name is in `KNOWN_DIRECTIVES`.
   * Absent for unknown/custom directives and for non-directive token types.
   */
  category?: DirectiveCategory;
}

/** Tokenize ChordPro source for syntax highlighting. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = splitLines(source);
  let offset = 0;

  for (const line of lines) {
    const lineTokens = tokenizeLine(line, offset);
    tokens.push(...lineTokens);
    offset += line.length;
  }

  return tokens;
}

/** Split source into lines preserving newline characters. */
function splitLines(source: string): string[] {
  const result: string[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') {
      result.push(source.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < source.length) {
    result.push(source.slice(start));
  }
  return result;
}

function tokenizeLine(line: string, baseOffset: number): Token[] {
  const trimmed = line.trimEnd();
  const content = trimmed.trimStart();
  const leadingSpaces = trimmed.length - content.length;

  // Empty / blank line → single lyric token
  if (!content) {
    return [{ type: 'lyric', text: line, start: baseOffset, end: baseOffset + line.length }];
  }

  // Comment line (#...)
  if (content.startsWith('#')) {
    return [{ type: 'comment', text: line, start: baseOffset, end: baseOffset + line.length }];
  }

  // Directive line ({...})
  const directiveMatch = content.match(/^\{([\s\S]*?)\}(.*)$/);
  if (directiveMatch) {
    return tokenizeDirectiveLine(line, baseOffset, content, directiveMatch, leadingSpaces);
  }

  // Lyric line — may contain [Chord] or [*annotation]
  return tokenizeLyricLine(line, baseOffset);
}

function tokenizeDirectiveLine(
  fullLine: string,
  baseOffset: number,
  content: string,
  directiveMatch: RegExpMatchArray,
  leadingSpaces: number,
): Token[] {
  const body = directiveMatch[1] ?? '';

  // Extract directive name
  const nameMatch = body.match(/^([A-Za-z_][A-Za-z0-9_]*)(-[A-Za-z0-9_]+(!)?)?/);
  const rawName = nameMatch ? (nameMatch[1] ?? '') : '';
  const canonical = normalizeName(rawName);

  let type: Token['type'];
  if (METADATA_DIRECTIVES.has(canonical)) {
    type = 'metadata-directive';
  } else if (canonical.startsWith('start_of_') || canonical === 'chorus') {
    type = 'section-open';
  } else if (canonical.startsWith('end_of_')) {
    type = 'section-end';
  } else {
    type = 'directive';
  }

  const directiveText = `{${body}}`;
  const directiveStart = baseOffset + leadingSpaces;
  const directiveEnd = directiveStart + directiveText.length;

  const tokens: Token[] = [];

  // Leading whitespace
  if (leadingSpaces > 0) {
    tokens.push({
      type: 'lyric',
      text: fullLine.slice(0, leadingSpaces),
      start: baseOffset,
      end: baseOffset + leadingSpaces,
    });
  }

  const category = DIRECTIVE_CATEGORY_MAP.get(canonical);
  const tok: Token = { type, text: directiveText, start: directiveStart, end: directiveEnd };
  if (category !== undefined) tok.category = category;
  tokens.push(tok);

  // Trailing content
  const trailingStart = directiveEnd;
  const trailingText = fullLine.slice(directiveEnd - baseOffset);
  if (trailingText) {
    tokens.push({ type: 'lyric', text: trailingText, start: trailingStart, end: baseOffset + fullLine.length });
  }

  return tokens;
}

function tokenizeLyricLine(line: string, baseOffset: number): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < line.length) {
    const openIdx = line.indexOf('[', pos);
    if (openIdx === -1) {
      // Remaining is lyric (includes trailing newline)
      tokens.push({ type: 'lyric', text: line.slice(pos), start: baseOffset + pos, end: baseOffset + line.length });
      break;
    }

    // Lyric text before [
    if (openIdx > pos) {
      tokens.push({ type: 'lyric', text: line.slice(pos, openIdx), start: baseOffset + pos, end: baseOffset + openIdx });
    }

    const closeIdx = line.indexOf(']', openIdx + 1);
    if (closeIdx === -1) {
      // Unclosed bracket — treat rest as lyric
      tokens.push({ type: 'lyric', text: line.slice(openIdx), start: baseOffset + openIdx, end: baseOffset + line.length });
      break;
    }

    const inner = line.slice(openIdx + 1, closeIdx);
    const tokenText = line.slice(openIdx, closeIdx + 1);
    const tokenType: Token['type'] = inner.startsWith('*') ? 'annotation' : 'chord';

    tokens.push({
      type: tokenType,
      text: tokenText,
      start: baseOffset + openIdx,
      end: baseOffset + closeIdx + 1,
    });

    pos = closeIdx + 1;
  }

  if (tokens.length === 0) {
    tokens.push({ type: 'lyric', text: line, start: baseOffset, end: baseOffset + line.length });
  }

  return tokens;
}
