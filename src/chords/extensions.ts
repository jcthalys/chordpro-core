/**
 * Built-in chord extension table.
 * One constant module; imported by the chord parser.
 */

// Major extensions (^ aliases maj)
const MAJOR_EXTENSIONS = `
2 3 4 5 6 69 7 7-5 7#5 7#9 7#9#5 7#9b5 7#9#11 7b5 7b9 7b9#5 7b9#9 7b9#11
7b9b13 7b9b5 7b9sus 7b13 7b13sus 7-9 7-9#11 7-9#5 7-9#9 7-9-13 7-9-5 7-9sus
711 7#11 7-13 7-13sus 7sus 7susadd3 7+ 7alt 9 9+ 9#5 9b5 9-5 9sus 9add6
maj7 maj711 maj7#11 maj13 maj7#5 maj7sus2 maj7sus4 ^7 ^711 ^7#11 ^7#5 ^7sus2
^7sus4 maj9 maj911 ^9 ^911 ^13 ^9#11 11 911 9#11 13 13#11 13#9 13b9 alt
add2 add4 add9 sus2 sus4 sus9 6sus2 6sus4 7sus2 7sus4 13sus2 13sus4
`.trim().split(/\s+/);

// Minor extensions (m-prefixed variants)
const MINOR_EXTENSIONS_BARE = `
#5 11 6 69 7b5 7-5 maj7 maj9 9maj7 9^7 add9 b6 #7 sus4 sus9 7sus4
`.trim().split(/\s+/);

// Other qualifiers that stand alone as the extension field
const OTHER_EXTENSIONS = `aug + dim 0 dim7 h h7 h9`.split(/\s+/);

/** Set of valid strict-mode extensions. */
export const STRICT_EXTENSIONS: ReadonlySet<string> = new Set([
  ...MAJOR_EXTENSIONS,
  ...OTHER_EXTENSIONS,
]);

/** Set of valid minor-suffixed extensions (used after 'm'/'mi'/'min'/'−'). */
export const MINOR_EXTENSIONS: ReadonlySet<string> = new Set(MINOR_EXTENSIONS_BARE);

/** All extensions (for documentation/tooling). */
export const ALL_EXTENSIONS: ReadonlyArray<string> = [
  ...MAJOR_EXTENSIONS,
  ...MINOR_EXTENSIONS_BARE,
  ...OTHER_EXTENSIONS,
];
