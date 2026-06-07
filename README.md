# chordpro-core

A standalone, dependency-free **TypeScript reference implementation of ChordPro parsing,
the data model, and transposition** — plus a set of clearly-separated
**auxiliary helpers** that applications commonly need but the format specification
deliberately leaves out.

**[Try it live →](https://jcthalys.github.io/chordpro-core/)** — interactive playground, all features in the browser.

> **Guiding policy:**
> Recognize and round-trip the entire format; implement semantics only for the
> well-defined subset; never silently drop anything.

## What this is

A **reference implementation of parsing, the data model, and transposition** for
[ChordPro 6](https://www.chordpro.org/chordpro/chordpro-file-format-specification/).
It turns text into data and data back into text. It contains **no UI code, no
framework imports, no DOM access, no CSS** — those belong in your application.

The rendering helpers (`renderText`, `renderHtml`) produce **a** rendering, not
**the** rendering. The ChordPro spec explicitly leaves font/layout decisions to the
formatter; this library does not attempt to match the reference program's PDF output.

## Tier 1 — Format core (the reference implementation)

Strictly what the public ChordPro specification defines: the line model, every
directive, the chord grammar (strict/relaxed), annotations, environments, and
transposition. Correctness is measured against the spec.

## Tier 2 — Auxiliary helpers (NOT part of the format)

Clearly labelled utilities real applications need but the spec does not cover:
`parseFreeText`, `tokenize`, `guessKey`, `getChordShape`, `toNashville`/`fromNashville`.

---

## Interactive playground

**[jcthalys.github.io/chordpro-core/](https://jcthalys.github.io/chordpro-core/)** — try every public API function live in the browser:

- **Rendered** — `renderHtml` output with chord-over-lyrics layout, styled by the playground's own CSS (demonstrating the library's class-name design)
- **Text** — `renderText` monospace output
- **AST** — the full parsed `Song` as JSON
- **Tokens** — `tokenize` output with color-coded token types and a legend
- **Round-trip** — `serialize(parse(x))` side-by-side with the original, with content-preservation indicators
- **Chord inspector** — `parseChord` output + `getChordShape` diagram for any chord you type
- **Free-text** — `parseFreeText` converts loose chord sheets to canonical ChordPro, with metadata pills
- **Directives** — `KNOWN_DIRECTIVES` rendered as a reference table

**Run locally:**

```sh
# From the repo root — builds the library first, then starts the playground dev server
npm run playground
```

---

## Install

```sh
npm install chordpro-core
```

Zero runtime dependencies. Requires Node 18+ or any modern bundler.

---

## Quick start

```ts
import { parse, transpose, tokenize, renderHtml, parseFreeText } from 'chordpro-core';

// Parse a ChordPro file
const song = parse(`
{title: Amazing Grace}
{key: G}
{start_of_verse}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
{end_of_verse}
`);

console.log(song.metadata.get('title')); // "Amazing Grace"

// Transpose up 2 semitones
const transposed = transpose(song, 2);

// Render to HTML
const html = renderHtml(transposed);

// Tokenize for syntax highlighting
const tokens = tokenize(source);
// Each token has: type, text, start, end — tiles the source exactly.

// Convert loose human-written text to ChordPro
const { chordpro, metadata, warnings } = parseFreeText(`
Amazing Grace
Traditional

G     D     Em    C
Amazing grace, how sweet the sound
`);
```

---

## API

### Tier 1 — Format core

#### `parse(source, options?): Song`

Parse ChordPro text. Never throws; records `Warning[]` and recovers.

```ts
interface ParseOptions {
  chordMode?: 'strict' | 'relaxed'; // default: 'strict'
  onUnknownDirective?: 'warn' | 'ignore'; // default: 'warn'
}
```

#### `serialize(song): string`

Serialize a `Song` back to ChordPro source. Round-trips all content faithfully:
original directive spellings, chord names, comments, metadata order, and
the entire preserve-only tail (legacy font/colour directives, delegated blocks, etc.).

#### `parseChord(name, options?): Chord`

Parse a single chord name. Never throws. Returns `parsed: false` on strict failure.

```ts
interface ChordParseOptions {
  mode?: 'strict' | 'relaxed';
}
```

#### `transpose(song, semitones, options?): Song`

Return a new `Song` with all chords transposed. Original song is not mutated.

#### `transposeChord(chord, semitones, options?): Chord`

Transpose a single chord. Unparsed chords pass through unchanged.

```ts
interface TransposeOptions {
  preferSharps?: boolean;
  preferFlats?: boolean;
}
```

#### `renderText(song, options?): string`

Chords-over-lyrics monospace text. Tab blocks verbatim.

#### `renderHtml(song, options?): string`

Semantic HTML string with class-annotated elements. No inline styles. No colors.
Your application maps token types to its own theme.

Class names: `.cp-song` `.cp-header` `.cp-title` `.cp-artist` `.cp-key`
`.cp-section` `.cp-section--chorus` `.cp-section--verse` `.cp-section--bridge`
`.cp-lyric-line` `.cp-chord` `.cp-annotation` `.cp-lyric`
`.cp-comment` `.cp-tab` `.cp-grid` `.cp-blank` `.cp-chorus-ref`

#### `DIRECTIVE_ALIASES: Readonly<Record<string,string>>`

Alias → canonical name map. Use to build a data-driven directive toolbar.

#### `KNOWN_DIRECTIVES: ReadonlyArray<DirectiveInfo>`

All recognized directives with name, aliases, category, and `takesArg`. Use to
avoid keeping a hand-copy of the directive list in your app.

---

### Tier 2 — Auxiliary helpers (not part of the format)

#### `parseFreeText(input): ParseFreeTextResult`

Convert loose human-written text to canonical ChordPro.

Detection rules (in order):
1. First content line → `title`
2. Second content line → `artist`
3. `Key:` / `Tom:` / `Tempo:` / `BPM:` / `Capo:` / `Time:` / `CCLI:` → metadata
4. Section headings (`Verse 1`, `Chorus`, `[Bridge]`, `Refrão`, `Verso`, `Ponte`) → `start_of_*`/`end_of_*` pairs
5. Chord-above-lyrics pairs — merged into inline `[C]word` tokens
6. Everything else → lyric content

English and Portuguese headings are supported.

```ts
interface ParseFreeTextResult {
  chordpro: string;
  metadata: Map<string, string>;
  warnings: Warning[];
}
```

#### `tokenize(source): Token[]`

Typed tokens for editor syntax highlighting. Offsets tile the source exactly
(concatenating `text` in order reproduces the input).

```ts
interface Token {
  type: 'metadata-directive' | 'section-open' | 'section-end'
      | 'directive' | 'chord' | 'annotation' | 'comment' | 'lyric';
  text: string;
  start: number;
  end: number;
}
```

No colors, no class names — your app maps token `type` to its own theme.

#### `guessKey(input): KeyGuess | null`

Frequency analysis of chord roots. Returns `null` when no chords or the most
frequent root appears fewer than 2 times.

```ts
interface KeyGuess { key: string; confidence: number }
```

#### `getChordShape(name, instrument, song?): DiagramData | null`

Returns chord fingering data (no SVG, no drawing). Checks `{define}`d chords in
the song first, then the built-in table (common guitar + ukulele open chords).

```ts
type instrument = 'guitar' | 'ukulele'
interface DiagramData { baseFret: number; frets: number[]; fingers?: number[] }
```

#### `toNashville(song, key) / fromNashville(song, key)`

Nashville Number System conversion. v1 stub — returns the song unchanged; full
implementation planned for a future version.

---

## Supported directives

See `FORMAT.md` for the full list. All directives are parsed and preserved.
The `KNOWN_DIRECTIVES` export gives you the list programmatically.

## Strict vs relaxed chord modes

**Strict (default):** extension must be in the built-in table
(e.g. `Am7b5` ✓, `Amystery` ✗).

**Relaxed:** any trailing text after a recognized root and optional qualifier is
accepted. Used by `parseFreeText` internally.

## Free-text parser rules

See the `parseFreeText` section above. The output is guaranteed to re-parse
with `parse()` with zero unknown-directive warnings for well-formed input.

## Non-goals (v1)

- PDF/page layout, fonts, actual chord-diagram image drawing
- The reference program's config-file system
- Rendering semantics for delegated ABC/Lilypond/SVG environments (preserve only)
- Any UI component, editor widget, or styling

## Contributing

Contributions welcome. Keep the Tier 1 / Tier 2 boundary clear; add tests for
any new behavior; maintain the zero-runtime-dependencies rule.

## License

MIT
