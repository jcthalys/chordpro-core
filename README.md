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

#### `soundingKey(song): string | null`

Returns the key the song _sounds_ in after capo transposition.
Reads `{key}` and `{capo}` from `song.metadata` and transposes up by capo
frets. Returns `null` when no `{key}` directive is present. If capo is 0 or
absent, returns the key unchanged. Accidental style follows the written key
(flat keys stay flat-preferred):

```ts
soundingKey(parse('{key: G}\n{capo: 2}'))  // → "A"
soundingKey(parse('{key: Am}\n{capo: 3}')) // → "Cm"
soundingKey(parse('{key: Bb}\n{capo: 1}')) // → "B"
soundingKey(parse('{capo: 2}'))            // → null  (no key)
```

#### `soundingKeyOf(key, capo): string`

Lower-level helper for consumers who have key and capo as separate strings/numbers.
Transposes `key` (e.g. `"G"`, `"Am"`, `"Bb"`) up by `capo` semitones. Preserves
qualifier (`m`, `dim`, etc.) and derives accidental preference from the written key.

```ts
soundingKeyOf('G', 2)   // → "A"
soundingKeyOf('Am', 3)  // → "Cm"
soundingKeyOf('Eb', 2)  // → "F"
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
3. Metadata lines (see table below) → corresponding ChordPro directives
4. Section headings (see table below) → `start_of_*`/`end_of_*` pairs
5. Chord-above-lyrics pairs — merged into inline `[C]word` tokens using Unicode-aware column alignment
6. Everything else → lyric content

Repeat markers (`(x2)`, `(2x)`, `(3 vezes)`, …) are detected:
- On a section heading line → `{meta: repeat N}` emitted first inside the section
- On a standalone line → `{comment: (xN)}`
- At the end of a lyric → `[*xN]` annotation appended

**Metadata lines recognized** (all case-insensitive, Portuguese and English):

| Input line | Directive emitted |
|---|---|
| `Tom: G` / `Key: G` | `{key: G}` |
| `Tom: A (Capo 2)` | `{key: A}` + `{capo: 2}` |
| `Tom com Capo 2: G` | `{key: G}` + `{capo: 2}` |
| `Tom (Capo 2): G` | `{key: G}` + `{capo: 2}` |
| `Tom real: A` | `{meta: tom_real A}` |
| `Capo: 2` / `Capo 2` | `{capo: 2}` |
| `Afinação: meio tom abaixo` | `{meta: afinacao meio tom abaixo}` |
| `BPM: 76` / `Tempo: 76` | `{tempo: 76}` |
| `Andamento: 120` | `{tempo: 120}` |
| `Andamento: Moderato` | `{meta: andamento Moderato}` |
| `Ritmo: Baião` | `{meta: ritmo Baião}` |
| `Compasso: 3/4` | `{time: 3/4}` |
| `Compasso: Binário` | `{meta: compasso Binário}` |
| `Fórmula de compasso: 4/4` | `{time: 4/4}` |
| `Artista: X` | `{artist: X}` |
| `Título: X` / `Titulo: X` | `{title: X}` |
| `Álbum: X` / `Album: X` | `{album: X}` |
| `Ano: 1994` | `{year: 1994}` |
| `Compositor: X` / `Composição: X` | `{composer: X}` |
| `Letrista: X` | `{lyricist: X}` |
| `Copyright: X` | `{copyright: X}` |
| `CCLI: N` | `{ccli: N}` |

**Section headings recognized**:

| Heading | Env | Notes |
|---|---|---|
| `Verse N` / `Verso N` / `Estrofe N` | `verse` | numbered or bare |
| `Chorus` / `Coro` / `Refrão` / `Refrao` | `chorus` | |
| `Pre-Chorus` / `Pré-Refrão` / `Pre-Refrao` / `Pré-Coro` / `Pre-Coro` | `prechorus` | |
| `Bridge` / `Ponte` | `bridge` | |
| `Intro` / `Introdução` / `Introducao` / `Abertura` | `verse` | with label |
| `Outro` / `Final` / `Finalização` / `Finalizacao` / `Coda` | `verse` | with label |
| `Solo N` / `Instrumental` / `Riff N` / `Interlúdio N` / `Interludio N` | `verse` | with label |

All headings accept optional `[brackets]`, optional trailing colon, optional number suffix, and optional `(xN)` repeat count.

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

Diatonic coverage scoring across all 24 candidate keys (12 major + 12 minor).
Returns the key whose scale best covers the chord roots in the song, weighted
by tonic and dominant frequency. Returns `null` when fewer than 2 total chord
occurrences are found. Minor keys include the qualifier: `"Am"` not `"A"`.

```ts
interface KeyGuess { key: string; confidence: number }
// key examples: "G", "C", "Am", "Em", "Bb", "F#"
```

#### `getChordShape(name, instrument, song?): DiagramData | null`

Returns chord fingering data (no SVG, no drawing). Lookup priority:
1. `{define}` / `{define-guitar}` / `{define-ukulele}` nodes in the song (instrument-selector respected)
2. Built-in table: 110+ guitar shapes and 55+ ukulele shapes covering natural and
   accidental major/minor, dominant 7th, major 7th, minor 7th, suspended, add9,
   9th, diminished, augmented, 6th, and power chords
3. Algorithmic barre fallback (guitar only): any simple major/minor chord not in the
   table is derived from an E-shape or A-shape moveable barre pattern

```ts
type instrument = 'guitar' | 'ukulele'
interface DiagramData { baseFret: number; frets: number[]; fingers?: number[] }
```

#### `toNashville(song, key) / fromNashville(song, key)`

Nashville Number System conversion. Replaces chord roots with scale degrees (1–7)
relative to the given key. Chromatic roots use a flat prefix: F in G → `b7`,
Bb in G → `b3`. Qualifiers, extensions, and bass notes are preserved:
`Am7` in C → `6m7`. `fromNashville(toNashville(song, key), key)` is identity
on all diatonic chord names.

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
