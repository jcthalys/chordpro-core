/**
 * Core AST types for the ChordPro format.
 * All types are JSON-serializable and reconstructable.
 */

// ─── Chord ───────────────────────────────────────────────────────────────────

/** A parsed or unparsed chord. */
export interface Chord {
  /** The original chord name as written in the source. */
  name: string;
  /** Root note (e.g. "C", "F#", "Bb"). Undefined if parse failed. */
  root?: string;
  /** Qualifier: "m", "dim", "aug", etc. */
  qualifier?: string;
  /** Extension: "7", "maj7", "sus4", etc. */
  extension?: string;
  /** Bass note for slash chords (e.g. "B" in "C/B"). */
  bass?: string;
  /** Whether the chord was successfully parsed. */
  parsed: boolean;
}

// ─── Segment (lyric line content) ────────────────────────────────────────────

/** One segment of a lyric line: a chord and/or annotation placed above a lyric run. */
export interface Segment {
  /** The chord positioned above this segment (may be absent). */
  chord?: Chord;
  /** An annotation (displayed in chord position, not parsed as chord). */
  annotation?: string;
  /** The lyric text for this segment (may be empty string for trailing chord). */
  lyric: string;
}

// ─── Lines ───────────────────────────────────────────────────────────────────

/** A blank line (stanza separator). */
export interface BlankLine {
  type: 'blank';
}

/** A comment line starting with `#`. */
export interface CommentLine {
  type: 'comment';
  /** Full source text of this line. */
  text: string;
}

/** A processed directive line. */
export interface DirectiveLine {
  type: 'directive';
  /** Canonical (long) directive name. */
  name: string;
  /** Original directive name as written in source (for round-trip). */
  originalName: string;
  /** The argument string (the part after `:` or the positional label). */
  argument?: string;
  /** Parsed HTML-attribute-style key/value pairs. */
  attributes: Record<string, string>;
  /** Conditional selector (e.g. "guitar" in `{chord-guitar: ...}`). */
  selector?: string;
  /** Whether the selector is negated (`!`). */
  negated?: boolean;
  /** Original full source text for round-trip fidelity. */
  source: string;
}

/** A lyric line with inline chord segments. */
export interface LyricLine {
  type: 'lyric';
  /** Ordered segments; each may have a chord and/or annotation above lyric text. */
  segments: Segment[];
}

/** A section node (verse, chorus, bridge, etc.) with its child lines. */
export interface SectionNode {
  type: 'section';
  /** Section kind (chorus, verse, bridge, prechorus, tab, grid, abc, ly, svg, textblock). */
  kind: SectionKind;
  /** Optional label from the opening directive (e.g. "Verse 1"). */
  label?: string;
  /** Child lines. TabBlock and GridBlock carry specialized content. */
  lines: Line[];
  /** Opening directive source for round-trip. */
  openSource: string;
  /** Closing directive source for round-trip. */
  closeSource: string;
  /** Original open directive name (for round-trip). */
  originalOpenName: string;
  /** Original close directive name (for round-trip). */
  originalCloseName: string;
  /** Attributes on the opening directive. */
  attributes: Record<string, string>;
  /** Whether this section is delegated (abc/ly/svg/textblock) — raw content preserved. */
  delegated: boolean;
  /** Raw inner content for delegated sections. */
  rawContent?: string;
}

/** Section kinds as defined by the ChordPro spec. */
export type SectionKind =
  | 'chorus'
  | 'verse'
  | 'bridge'
  | 'prechorus'
  | 'tab'
  | 'grid'
  | 'abc'
  | 'ly'
  | 'svg'
  | 'textblock'
  | 'custom';

/** A standalone `{chorus}` directive, referencing a previous chorus. */
export interface ChorusReference {
  type: 'chorus_reference';
  /** Optional label argument. */
  label?: string;
  /** Original source for round-trip. */
  source: string;
}

/** A tab block — verbatim monospace content, no chord parsing inside. */
export interface TabLine {
  type: 'tab_line';
  text: string;
}

/**
 * A parsed `{define}` or `{chord}` directive — Tier 1 structured model.
 * The spec marks these as "behavior: parse grammar"; structured fields
 * are preferred over raw argument-string access.
 */
export interface ChordDef {
  type: 'chord_def';
  /** Chord name (e.g. "Am"). */
  name: string;
  /** Original directive name ('define' or 'chord') for round-trip. */
  originalName: 'define' | 'chord';
  /** Base fret position (1-indexed). Default 1. */
  baseFret?: number;
  /** Fret positions per string (-1 = muted, 0 = open). */
  frets?: number[];
  /** Finger numbers per string. */
  fingers?: number[];
  /** Keyboard instrument: intervals from root (0=root, 4=third, 7=fifth…). */
  keys?: number[];
  /** Copy diagram properties from another named chord. */
  copy?: string;
  /** When true, copy ALL properties (vs. inheritable subset). */
  copyAll?: boolean;
  /** Displayed name — may differ from the defined name. */
  display?: string;
  /**
   * Instrument this definition applies to.
   * Set when the directive uses the `{define-guitar:}` / `{define-ukulele:}` selector form.
   * Absent means the definition applies to any instrument.
   */
  instrument?: 'guitar' | 'ukulele';
  /** Original source for round-trip fidelity. */
  source: string;
}

/** A grid block row. */
export interface GridRow {
  type: 'grid_row';
  /** Cells separated by `|` bar markers. */
  cells: GridCell[];
  /** Original source line for lossless round-trip. */
  source?: string;
}

/** A single cell in a grid row. */
export interface GridCell {
  /** Chord tokens in this cell. */
  chords: Chord[];
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type Line =
  | BlankLine
  | CommentLine
  | DirectiveLine
  | LyricLine
  | SectionNode
  | ChorusReference
  | TabLine
  | GridRow
  | ChordDef;

// ─── Warning ─────────────────────────────────────────────────────────────────

/** A non-fatal parse warning. */
export interface Warning {
  /** 1-based line number. */
  line: number;
  /** 1-based column (optional). */
  column?: number;
  /** Machine-readable code. */
  code: string;
  /** Human-readable message. */
  message: string;
}

// ─── Song ─────────────────────────────────────────────────────────────────────

/**
 * The root AST node for a parsed ChordPro song.
 * JSON-serializable (Map is serialized via Array.from entries).
 */
export interface Song {
  /** Ordered metadata key/value pairs (preserves order of directives). */
  metadata: Map<string, string>;
  /** All lines in document order. */
  lines: Line[];
  /** Non-fatal parse warnings. */
  warnings: Warning[];
}
