/**
 * chordpro-core — public API
 *
 * Exports are grouped by tier with comments marking the boundary.
 * Read the README for the distinction between Tier 1 (format core)
 * and Tier 2 (auxiliary helpers that are NOT part of the format).
 */

// ── Tier 1: format core ──────────────────────────────────────────────────────
export { parse } from './parser/parse.js';
export type { ParseOptions } from './parser/parse.js';

export { serialize } from './parser/serialize.js';

export { parseChord } from './chords/parseChord.js';
export type { ChordParseOptions } from './chords/parseChord.js';

export { transpose, transposeChord } from './chords/transpose.js';
export type { TransposeOptions } from './chords/transpose.js';

export { renderText } from './render/renderText.js';
export type { TextRenderOptions } from './render/renderText.js';

export { renderHtml } from './render/renderHtml.js';
export type { HtmlRenderOptions } from './render/renderHtml.js';

export { DIRECTIVE_ALIASES, KNOWN_DIRECTIVES } from './parser/directives.js';
export type { DirectiveInfo, DirectiveCategory } from './parser/directives.js';

// ── Tier 2: auxiliary helpers (not part of the format) ──────────────────────
export { parseFreeText } from './freetext/parseFreeText.js';
export type { ParseFreeTextResult } from './freetext/parseFreeText.js';

export { tokenize } from './tokenize/tokenize.js';
export type { Token } from './tokenize/tokenize.js';

export { guessKey } from './analysis/guessKey.js';
export type { KeyGuess } from './analysis/guessKey.js';

export { getChordShape } from './analysis/chordShapes.js';
export type { DiagramData } from './analysis/chordShapes.js';

export { toNashville, fromNashville } from './chords/nashville.js';

// ── Types (all exported, all TSDoc'd) ────────────────────────────────────────
export type {
  Chord,
  Segment,
  BlankLine,
  CommentLine,
  DirectiveLine,
  LyricLine,
  SectionNode,
  SectionKind,
  ChorusReference,
  TabLine,
  GridRow,
  GridCell,
  Line,
  Warning,
  Song,
} from './model/types.js';
