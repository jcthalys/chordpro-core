/**
 * Alias normalization table, known-directive registry, and section kind maps.
 * All canonical names are long-form. Short (alias) names normalize on read.
 */

export interface DirectiveInfo {
  name: string;
  aliases: string[];
  category: DirectiveCategory;
  takesArg: boolean;
}

export type DirectiveCategory =
  | 'preamble'
  | 'metadata'
  | 'formatting'
  | 'environment-open'
  | 'environment-close'
  | 'chord-def'
  | 'transposition'
  | 'output-layout'
  | 'tier2-metadata'
  | 'unknown';

/** Alias → canonical long name. Exported as the public DIRECTIVE_ALIASES map. */
export const DIRECTIVE_ALIASES: Readonly<Record<string, string>> = {
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  sob: 'start_of_bridge',
  eob: 'end_of_bridge',
  sot: 'start_of_tab',
  eot: 'end_of_tab',
  sog: 'start_of_grid',
  eog: 'end_of_grid',
  c: 'comment',
  ci: 'comment_italic',
  cb: 'comment_box',
  t: 'title',
  st: 'subtitle',
  ns: 'new_song',
  np: 'new_page',
  npp: 'new_physical_page',
  colb: 'column_break',
  col: 'columns',
  g: 'grid',
  ng: 'no_grid',
  cf: 'chordfont',
  cs: 'chordsize',
};

/** Normalize a directive name: alias → canonical. Unknown names returned as-is. */
export function normalizeName(raw: string): string {
  const lower = raw.toLowerCase();
  return DIRECTIVE_ALIASES[lower] ?? lower;
}

/** Maps section-open canonical name → section kind. */
export const SECTION_OPEN_TO_KIND: Readonly<Record<string, string>> = {
  start_of_chorus: 'chorus',
  start_of_verse: 'verse',
  start_of_bridge: 'bridge',
  start_of_prechorus: 'prechorus',
  start_of_pre_chorus: 'prechorus',
  start_of_tab: 'tab',
  start_of_grid: 'grid',
  start_of_abc: 'abc',
  start_of_ly: 'ly',
  start_of_svg: 'svg',
  start_of_textblock: 'textblock',
};

/** Maps section-close canonical name → section kind. */
export const SECTION_CLOSE_TO_KIND: Readonly<Record<string, string>> = {
  end_of_chorus: 'chorus',
  end_of_verse: 'verse',
  end_of_bridge: 'bridge',
  end_of_prechorus: 'prechorus',
  end_of_pre_chorus: 'prechorus',
  end_of_tab: 'tab',
  end_of_grid: 'grid',
  end_of_abc: 'abc',
  end_of_ly: 'ly',
  end_of_svg: 'svg',
  end_of_textblock: 'textblock',
};

/** Delegated (raw-content) section kinds. */
export const DELEGATED_KINDS = new Set(['abc', 'ly', 'svg', 'textblock']);

/** Metadata directive canonical names (Tier 1 core). */
export const METADATA_DIRECTIVES = new Set([
  'title',
  'sorttitle',
  'subtitle',
  'artist',
  'sortartist',
  'composer',
  'lyricist',
  'copyright',
  'album',
  'year',
  'key',
  'time',
  'tempo',
  'duration',
  'capo',
  'meta',
  'tag',
]);

/** Tier-2 metadata directives (clearly non-core; mapped to canonical keys). */
export const TIER2_METADATA_MAP: Readonly<Record<string, string>> = {
  ccli: 'ccli',
  ccli_number: 'ccli',
};

/** All known canonical directive names with their info. */
export const KNOWN_DIRECTIVES: ReadonlyArray<DirectiveInfo> = [
  // Preamble
  { name: 'new_song', aliases: ['ns'], category: 'preamble', takesArg: false },

  // Metadata (Tier 1)
  { name: 'title', aliases: ['t'], category: 'metadata', takesArg: true },
  { name: 'sorttitle', aliases: [], category: 'metadata', takesArg: true },
  { name: 'subtitle', aliases: ['st'], category: 'metadata', takesArg: true },
  { name: 'artist', aliases: [], category: 'metadata', takesArg: true },
  { name: 'sortartist', aliases: [], category: 'metadata', takesArg: true },
  { name: 'composer', aliases: [], category: 'metadata', takesArg: true },
  { name: 'lyricist', aliases: [], category: 'metadata', takesArg: true },
  { name: 'copyright', aliases: [], category: 'metadata', takesArg: true },
  { name: 'album', aliases: [], category: 'metadata', takesArg: true },
  { name: 'year', aliases: [], category: 'metadata', takesArg: true },
  { name: 'key', aliases: [], category: 'metadata', takesArg: true },
  { name: 'time', aliases: [], category: 'metadata', takesArg: true },
  { name: 'tempo', aliases: [], category: 'metadata', takesArg: true },
  { name: 'duration', aliases: [], category: 'metadata', takesArg: true },
  { name: 'capo', aliases: [], category: 'metadata', takesArg: true },
  { name: 'meta', aliases: [], category: 'metadata', takesArg: true },
  { name: 'tag', aliases: [], category: 'metadata', takesArg: true },

  // Tier-2 metadata convenience
  { name: 'ccli', aliases: [], category: 'tier2-metadata', takesArg: true },
  { name: 'ccli_number', aliases: [], category: 'tier2-metadata', takesArg: true },

  // Formatting
  { name: 'comment', aliases: ['c'], category: 'formatting', takesArg: true },
  { name: 'comment_italic', aliases: ['ci'], category: 'formatting', takesArg: true },
  { name: 'comment_box', aliases: ['cb'], category: 'formatting', takesArg: true },
  { name: 'highlight', aliases: [], category: 'formatting', takesArg: false },
  { name: 'image', aliases: [], category: 'formatting', takesArg: true },

  // Environments — open
  { name: 'start_of_chorus', aliases: ['soc'], category: 'environment-open', takesArg: false },
  { name: 'start_of_verse', aliases: ['sov'], category: 'environment-open', takesArg: false },
  { name: 'start_of_bridge', aliases: ['sob'], category: 'environment-open', takesArg: false },
  { name: 'start_of_prechorus', aliases: [], category: 'environment-open', takesArg: false },
  { name: 'start_of_pre_chorus', aliases: [], category: 'environment-open', takesArg: false },
  { name: 'start_of_tab', aliases: ['sot'], category: 'environment-open', takesArg: false },
  { name: 'start_of_grid', aliases: ['sog'], category: 'environment-open', takesArg: false },
  { name: 'start_of_abc', aliases: [], category: 'environment-open', takesArg: false },
  { name: 'start_of_ly', aliases: [], category: 'environment-open', takesArg: false },
  { name: 'start_of_svg', aliases: [], category: 'environment-open', takesArg: false },
  { name: 'start_of_textblock', aliases: [], category: 'environment-open', takesArg: false },
  { name: 'chorus', aliases: [], category: 'environment-open', takesArg: false },

  // Environments — close
  { name: 'end_of_chorus', aliases: ['eoc'], category: 'environment-close', takesArg: false },
  { name: 'end_of_verse', aliases: ['eov'], category: 'environment-close', takesArg: false },
  { name: 'end_of_bridge', aliases: ['eob'], category: 'environment-close', takesArg: false },
  { name: 'end_of_prechorus', aliases: [], category: 'environment-close', takesArg: false },
  { name: 'end_of_pre_chorus', aliases: [], category: 'environment-close', takesArg: false },
  { name: 'end_of_tab', aliases: ['eot'], category: 'environment-close', takesArg: false },
  { name: 'end_of_grid', aliases: ['eog'], category: 'environment-close', takesArg: false },
  { name: 'end_of_abc', aliases: [], category: 'environment-close', takesArg: false },
  { name: 'end_of_ly', aliases: [], category: 'environment-close', takesArg: false },
  { name: 'end_of_svg', aliases: [], category: 'environment-close', takesArg: false },
  { name: 'end_of_textblock', aliases: [], category: 'environment-close', takesArg: false },

  // Chord definitions
  { name: 'define', aliases: [], category: 'chord-def', takesArg: true },
  { name: 'chord', aliases: [], category: 'chord-def', takesArg: true },

  // Transposition
  { name: 'transpose', aliases: [], category: 'transposition', takesArg: true },

  // Output/layout/legacy (preserve-only)
  { name: 'new_page', aliases: ['np'], category: 'output-layout', takesArg: false },
  { name: 'new_physical_page', aliases: ['npp'], category: 'output-layout', takesArg: false },
  { name: 'column_break', aliases: ['colb'], category: 'output-layout', takesArg: false },
  { name: 'columns', aliases: ['col'], category: 'output-layout', takesArg: true },
  { name: 'grid', aliases: ['g'], category: 'output-layout', takesArg: false },
  { name: 'no_grid', aliases: ['ng'], category: 'output-layout', takesArg: false },
  { name: 'titles', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'diagrams', aliases: [], category: 'output-layout', takesArg: false },
  { name: 'pagetype', aliases: [], category: 'output-layout', takesArg: true },
  // Legacy font/size/colour
  { name: 'textfont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'textsize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'textcolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'textcolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'chordfont', aliases: ['cf'], category: 'output-layout', takesArg: true },
  { name: 'chordsize', aliases: ['cs'], category: 'output-layout', takesArg: true },
  { name: 'chordcolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'chordcolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'titlefont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'titlesize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'titlecolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'titlecolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'subtitlefont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'subtitlesize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'subtitlecolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'subtitlecolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'tabfont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'tabsize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'tabcolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'tabcolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'chorusfont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'chorussize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'choruscolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'choruscolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'footerfont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'footersize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'footercolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'footercolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'gridfont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'gridsize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'gridcolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'gridcolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'labelfont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'labelsize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'labelcolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'labelcolor', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'tocfont', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'tocsize', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'toccolour', aliases: [], category: 'output-layout', takesArg: true },
  { name: 'toccolor', aliases: [], category: 'output-layout', takesArg: true },
];

const _knownNames = new Set(KNOWN_DIRECTIVES.map((d) => d.name));

/** Returns true if this canonical directive name is in the known-directive registry. */
export function isKnownDirective(canonicalName: string): boolean {
  return _knownNames.has(canonicalName);
}
