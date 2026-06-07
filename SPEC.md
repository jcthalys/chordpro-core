# Build Specification: `chordpro-core`

A standalone, dependency-free **TypeScript** library that is a **reference
implementation of the ChordPro file format** — its parsing, data model, and
transposition — plus a set of clearly-separated **auxiliary utilities** that
applications commonly need but the format spec deliberately leaves out.

This document is the complete, authoritative specification. Implement the
library exactly as described, with an extensive test suite and full
documentation.

The library is a pure, framework-free engine. It contains **no UI code, no
framework imports, no styling, no DOM access**. It turns text into data and
data into text, and exposes pure functions a consuming application can render
however it likes.

> **Hard rule:** no React, no DOM, no CSS, no Tailwind class names, no framework
> of any kind anywhere in this package. If a feature needs the DOM or styling,
> the library exposes the *pure data* for it and the application does the
> rendering. (Syntax highlighting: the library returns typed tokens; the app
> paints them.)

---

## 0. Scope, tiers, and the guiding policy

This library has two tiers, kept deliberately separate in code, tests, and
docs. The distinction matters: Tier 1 lets the project credibly call itself a
reference implementation of the format; Tier 2 is honest value-add built on top.

### Tier 1 — Format core (the reference implementation)

Strictly what the public **ChordPro File Format Specification** (chordpro.org,
ChordPro 6) defines: the line model, every directive in the spec, the chord
grammar (strict/relaxed) with the official extension list, annotations,
environments, and transposition. Correctness here is measured **against the
spec**, and against the reference implementation's documented behavior where the
spec defers to the formatter.

### Tier 2 — Auxiliary utilities (value-add, NOT part of the format)

Things the spec intentionally does **not** cover but real applications need.
These live in separate modules and are clearly labelled in the README as
"helpers, not part of the ChordPro format":
- `parseFreeText` — loose human-written sheets → canonical ChordPro.
- `tokenize` — typed tokens for editor syntax highlighting.
- `guessKey` — key detection.
- `getChordShape` — chord-name → fingering/diagram **data**.
- Nashville conversion (`toNashville`/`fromNashville`).
- Extraction of common-but-non-core metadata such as `ccli`.

### The guiding policy (state this verbatim in the README)

> **Recognize and round-trip the entire format; implement semantics only for the
> well-defined subset; never silently drop anything.**

Concretely:
- **Parse-and-preserve everything.** Every directive and construct in the format
  — including the long tail (legacy font/size/colour directives, delegated
  ABC/Lilypond/SVG environments, layout directives) — is recognized, kept in the
  model, and serialized back losslessly.
- **Implement behavior for the defined subset.** Produce meaningful structure /
  transforms for the parts with clear, formatter-independent semantics (metadata,
  sections, chords, transposition). For the rest, hold the data faithfully but
  do not invent behavior.
- **Never drop.** If the library doesn't act on a construct, it still round-trips
  it. A naive parser that discards what it doesn't understand is exactly the bug
  this library exists to prevent.

### A note on "reference implementation" claims (be modest and precise)

The spec is explicit that a directive is "a friendly request" and the actual
*rendering* is up to the formatter — title placement, how a chorus looks, fonts,
page layout are program decisions, not format decisions. Therefore:
- This project is a reference implementation of **parsing, the data model, and
  transposition**. Claim that, precisely.
- The rendering helpers (§9) produce **a** rendering, not **the** rendering. Say
  so in the README. Do not claim output-fidelity parity with the reference
  program's PDF engine — that is explicitly out of scope.

### Non-goals (v1)

- PDF/page layout, fonts, actual chord-diagram image drawing.
- The reference program's config-file system.
- Rendering semantics for delegated ABC/Lilypond/SVG environments (preserve only).
- Any UI component, editor widget, or styling.

---

## 1. The ChordPro format (Tier 1 contract)

Distilled from the public ChordPro File Format Specification. A song is a
sequence of lines; each line is exactly one of:

1. **Blank line** — stanza separator.
2. **Comment/remark** — starts with `#`. Ignored for display; preserved in the
   model for round-tripping.
3. **Directive** — starts with `{`, ends with `}`. See §2.
4. **Lyric line** — anything else; may contain inline chords. See §3.

### One engine, layered options — not separate "modes"

A single parser produces a single AST. What a consuming app might call "Simple",
"Directive", and "Raw" editor modes are **not** three parsers:
- **Simple** = the Tier 2 free-text parser (§4) → ChordPro → the one core parser.
- **Directive / Raw** = the one core parser over valid ChordPro; their difference
  is purely the app's toolbar/UX, not this library's concern.

Implement the core once. Everything else is an option or a separate pure
function over the same AST.

---

## 2. Directives (Tier 1)

A directive is `{name}`, `{name: argument}`, or `{name attributes}`.

- Name/argument separated by colon and/or whitespace.
- **HTML-attribute-style** args: `{image: src="x.jpg" scale="50%"}`. Single or
  double quotes, equivalent.
- Single-argument directives may also take an explicit attribute form:
  `{start_of_verse Verse 1}` ≡ `{start_of_verse label="Verse 1"}`.
- **Long and short names**: parse both, normalize to the long name in the model,
  retain the original spelling for round-trip fidelity.
- **Conditional selectors**: `{comment-tenor: ...}`, `{define-guitar: ...}`;
  trailing `!` negates. Capture `selector` + `negated`. A section *end* directive
  must NOT carry a selector.
- **Custom extensions**: any directive whose name starts with `x_` is preserved
  and must never produce a warning.

### Alias normalization table (normalize on read; keep original for serialize)

```
soc → start_of_chorus    eoc → end_of_chorus
sov → start_of_verse     eov → end_of_verse
sob → start_of_bridge    eob → end_of_bridge
sot → start_of_tab       eot → end_of_tab
sog → start_of_grid      eog → end_of_grid
c   → comment            ci  → comment_italic    cb → comment_box
t   → title              st  → subtitle
ns  → new_song           np  → new_page          npp → new_physical_page
colb→ column_break       col → columns
g   → grid               ng  → no_grid
```

### Directives to support

Per the **parse-and-preserve-everything** policy: all of the below are
recognized, modelled, and round-tripped. Those marked *(behavior)* also get
implemented semantics; those marked *(preserve)* are held faithfully as generic
nodes without invented behavior.

**Preamble:** `new_song` *(behavior: song boundary)*

**Meta-data** *(behavior: into an ordered metadata map)*:
`title` (t), `sorttitle`, `subtitle` (st), `artist`, `sortartist`, `composer`,
`lyricist`, `copyright`, `album`, `year`, `key`, `time`, `tempo`, `duration`,
`capo`, `meta`, `tag`.
Tier-2 metadata convenience (clearly marked as non-core in code): `{ccli: …}` /
`{ccli_number: …}` → metadata `ccli`. (`copyright` *is* core; `ccli` is not.)

**Formatting** *(behavior: typed nodes)*: `comment` (c), `comment_italic` (ci),
`comment_box` (cb), `highlight`, `image`.

**Environments** *(behavior: paired → section node with children; start may carry
a `label`)*:
- `start_of_chorus`/`end_of_chorus` + standalone `chorus` → a distinct
  `ChorusReference` node (the app decides whether to expand or just label it).
- `start_of_verse`/`end_of_verse`
- `start_of_bridge`/`end_of_bridge`
- Pre-chorus: model an explicit `prechorus`/`pre_chorus` directive as a section
  of kind `prechorus`; round-trip whatever directive form is used.
- `start_of_tab`/`end_of_tab` — content **verbatim monospace**; do NOT parse
  inline chords inside.
- `start_of_grid`/`end_of_grid` — parse rows of chord tokens, preserve bar `|`
  structure; no diagrams.

**Delegated environments** *(preserve: store raw content, mark delegated, do NOT
render)*: `start_of_abc`/`end_of_abc`, `start_of_ly`/`end_of_ly`,
`start_of_svg`/`end_of_svg`, `start_of_textblock`/`end_of_textblock`.

**Chord definitions** *(behavior: parse grammar)*: `define`, `chord`.
`{define: NAME base-fret N frets f f f f f f fingers ...}` → name, base fret,
frets[], optional fingers[]. Tolerate missing pieces.

**Transposition** *(behavior)*: `transpose` (affects following lines until
changed).

**Output / layout / legacy** *(preserve: generic `Directive` node, no invented
semantics)*: `new_page` (np), `new_physical_page` (npp), `column_break` (colb),
`columns` (col), legacy font/size/colour directives (`textfont`, `chordsize`,
`titlecolour`, `chordfont`, …), `grid`/`no_grid`, `titles`, `diagrams`,
`pagetype`.

**Unknown directives** *(preserve)*: keep as generic `Directive`, emit a
non-fatal warning (unless `x_`-prefixed).

---

## 3. Lyric lines and inline chords (Tier 1)

- Chord between `[` and `]`, placed immediately before its syllable:
  `Swing [D]low, sweet [G]chari[D]ot`.
- A line may start with a chord, end with a chord (no trailing lyric), or have a
  chord mid-word.
- **Annotations:** `[*text]` — leading `*` means "print as text in chord
  position, not a chord". Strip `*`, mark as annotation, never parse as chord,
  never transpose.
- A lyric line → ordered list of **segments**:
  `{ chord?: Chord, annotation?: string, lyric: string }`. Lyric may be empty
  (trailing chord); chord may be absent (plain run).
- Inside `start_of_tab`, `[...]` is literal, not a chord.

---

## 4. Free-text parser (`parseFreeText`) — **Tier 2**

> Auxiliary utility. NOT part of the ChordPro format. Lives in `src/freetext/`,
> clearly labelled as a helper in the README.

A pure function: loose human-written text → canonical ChordPro + extracted
metadata. The highest-value auxiliary piece; specify precisely.

**Signature:** `parseFreeText(input: string): ParseResult`
where `ParseResult = { chordpro: string; metadata: Map<string,string>; warnings: Warning[] }`.

**Detection rules, in order:**

1. **Title** — first content line that is not a chord line, directive, or
   metadata line → `title`.
2. **Artist** — next such line (same exclusions) → `artist`.
3. **Metadata lines** — case-insensitive: `Key: X`, `Tempo: N`, `BPM: N`,
   `Capo: N`, `Time: X/Y`, `CCLI: N`, plus `Tom: X` (Portuguese alias for Key)
   → metadata; not emitted as lyrics.
4. **Section headings** — bare headings (`Verse 1`, `Chorus`, `Bridge`,
   `Pre-Chorus`) or bracketed (`[Bridge]`, `[Chorus]`) → matching env pairs
   wrapping following lines until the next heading/blank-separated block.
   Support English **and Portuguese** (`Verso`, `Refrão`/`Coro`, `Ponte`).
5. **Chord-above-lyrics pairs** — when a line is a *chord-only line* (its tokens
   are all parseable chords/whitespace) and the next is lyrics, merge into inline
   `[C]word` tokens by horizontal column position. Robust to imperfect alignment
   (snap each chord to nearest following word boundary at/after its column).
6. **Everything else** → lyric content.

**Chord-only-line detection** uses the chord parser (§5) in relaxed mode with a
threshold (a line whose non-whitespace tokens are ≥ ~80% parseable chords is a
chord line) so lyric lines with a stray capital aren't misread.

**Key auto-detection:** if no `Key:`/`Tom:` line found, run `guessKey` (§7); set
`key` only if the most-frequent root occurs ≥2 times (configurable, default 2).

**Guarantee:** output re-parses with the core parser with zero warnings for
well-formed input.

---

## 5. Chord parsing (Tier 1)

Two modes: **strict** (default) and **relaxed**.

Decomposition: **root**, optional **qualifier**, optional **extension**, optional
**bass** (`/` + root).

- **root:** `A`–`G` (+ `H` German), `b`/`#` accidentals. Extensible note table
  (recognize alternate spellings like `Bes` = B-flat). Roman (`I`–`VII`) and
  Nashville (`1`–`7`) recognition behind a flag — design to grow into Tier-2
  Nashville (§6).
- **qualifier:** minor = `m`/`mi`/`min`/`-`; plus `aug`/`+`, `dim`/`0`, etc.
- **extension:** strict → must match the built-in list below; relaxed → any
  trailing text accepted (`Coda` = root `C` + ext `oda`).
- **bass:** `/` + root (`C/B` → bass `B`).

Result: `{ name, root, qualifier, extension, bass, parsed: boolean }`. On strict
failure, return `parsed:false` but keep raw `name` — **never throw**.

**Real-world chords that MUST parse in strict mode** (regression set):
`Cadd9`, `G7sus4`, `Am7b5`, `Fmaj7/A`, `Dsus2`, `Bbmaj7`, `F#dim7`, `Gaug`,
`Esus2`, `Bm7`, plus the spec table: `C`, `F#`, `Bb`, `Am7`, `C/B`, `Besm`.

### Built-in extension list (one constant module)

Major (`^` aliases `maj`):
`2 3 4 5 6 69 7 7-5 7#5 7#9 7#9#5 7#9b5 7#9#11 7b5 7b9 7b9#5 7b9#9 7b9#11
7b9b13 7b9b5 7b9sus 7b13 7b13sus 7-9 7-9#11 7-9#5 7-9#9 7-9-13 7-9-5 7-9sus
711 7#11 7-13 7-13sus 7sus 7susadd3 7+ 7alt 9 9+ 9#5 9b5 9-5 9sus 9add6
maj7 maj711 maj7#11 maj13 maj7#5 maj7sus2 maj7sus4 ^7 ^711 ^7#11 ^7#5 ^7sus2
^7sus4 maj9 maj911 ^9 ^911 ^13 ^9#11 11 911 9#11 13 13#11 13#9 13b9 alt
add2 add4 add9 sus2 sus4 sus9 6sus2 6sus4 7sus2 7sus4 13sus2 13sus4`

Minor (marked `m`/`mi`/`min`/`-`; enumerate the `m`-prefixed variants):
`#5 11 6 69 7b5 7-5 maj7 maj9 9maj7 9^7 add9 b6 #7 sus4 sus9 7sus4`

Other: `aug +  dim 0  dim7  h h7 h9`

---

## 6. Transposition (Tier 1) + Nashville (Tier 2)

**Transposition — Tier 1:**
- `transpose(song, semitones, options)`, `transposeChord(chord, semitones, options)`.
- Requires a parsed `root`. Annotations and unparsed chords pass through.
- Options: accidental preference (sharps/flats); honor existing `{key:}` /
  `{transpose:}`.
- Preserve qualifier/extension/bass exactly: `Am7`+2→`Bm7`; `C/B`+2→`D/C#`
  (or `D/Db` under flats). +n then −n is identity on chord names.

**Nashville — Tier 2** (auxiliary, `src/chords/nashville.ts`):
- `toNashville(song|chord, key)` / `fromNashville(...)`. Pure transforms mapping
  roots to scale degrees relative to a key. Mark clearly as a helper.

> **v1 sizing decision:** Nashville may ship as a *stub* (typed signatures +
> `not implemented` behavior + a couple of placeholder tests) if it threatens to
> expand v1. The Tier-1 core and `parseFreeText` are the v1 priorities. Decide
> explicitly; do not let auxiliary features delay the reference core.

---

## 7. Key detection + chord-shape data — **Tier 2**

> Auxiliary utilities, `src/analysis/`. NOT part of the format.

- `guessKey(songOrChordpro): { key: string; confidence: number } | null` —
  frequency analysis of chord roots + simple major/minor heuristic.
- `getChordShape(name, instrument): DiagramData | null` →
  `{ baseFret, frets: number[], fingers?: number[] }` for guitar and ukulele,
  from a built-in table plus any `{define}`d chords in the song. **Data only — no
  SVG, no drawing.** Seed a reasonable built-in table of common open chords.

> Same v1 sizing note as Nashville: `getChordShape` may ship with a small seed
> table and grow later. Don't let the table's size gate v1.

---

## 8. Tokenizer (`tokenize`) — **Tier 2**

> Auxiliary utility for editor syntax highlighting, `src/tokenize/`. Pure, no
> DOM, no colors.

`tokenize(source: string): Token[]`:

```ts
interface Token {
  type: 'metadata-directive' | 'section-open' | 'section-end'
      | 'directive' | 'chord' | 'annotation' | 'comment' | 'lyric';
  text: string;   // exact source slice
  start: number;  // offset in source
  end: number;
}
```

- Offsets must exactly tile the source (concatenating `text` in order reproduces
  the input) — lets an app overlay a mirror div character-for-character.
- `{title:}`/`{key:}` → `metadata-directive`; `{start_of_*}` → `section-open`;
  `{end_of_*}` → `section-end`; `[G]` → `chord`; `[*Coda]` → `annotation`;
  `{comment:}` and `#…` → `comment`; plain → `lyric`.
- **No colors, no class names.** The app maps token `type` → its own theme.
- Pure and fast; suitable to call on a debounce.

---

## 9. Rendering helpers (Tier 1 model, "a renderer not the renderer")

String output only — never DOM or framework nodes. Per §0, these are **a**
rendering, not a fidelity-match to the reference program.

- `renderText(song, options?)` — chords-over-lyrics monospace text, chords
  aligned above the correct syllable; tab blocks verbatim; chorus distinct.
- `renderHtml(song, options?)` — a **string** of semantic, class-annotated
  markup. Document the class names; the app may style or ignore them. (For a
  live editor the app should prefer `tokenize`.)

---

## 10. Public API (TypeScript)

Clean, documented, named exports. Group exports by tier in `index.ts` with
comments so the boundary is visible to anyone reading the source.

```ts
// ── Tier 1: format core ──
parse(source: string, options?: ParseOptions): Song
serialize(song: Song): string
parseChord(name: string, options?: ChordParseOptions): Chord
transpose(song: Song, semitones: number, options?: TransposeOptions): Song
transposeChord(chord: Chord, semitones: number, options?: TransposeOptions): Chord
renderText(song: Song, options?: TextRenderOptions): string
renderHtml(song: Song, options?: HtmlRenderOptions): string
DIRECTIVE_ALIASES: Readonly<Record<string,string>>
KNOWN_DIRECTIVES: ReadonlyArray<DirectiveInfo>   // name, short, category, takesArg

// ── Tier 2: auxiliary helpers (not part of the format) ──
parseFreeText(input: string): ParseResult
tokenize(source: string): Token[]
guessKey(input: string | Song): KeyGuess | null
getChordShape(name: string, instrument: 'guitar' | 'ukulele'): DiagramData | null
toNashville(song: Song, key: string): Song
fromNashville(song: Song, key: string): Song

// ── Types (all exported, all TSDoc'd) ──
interface Song { metadata: Map<string,string>; lines: Line[]; warnings: Warning[] }
type Line = LyricLine | DirectiveLine | SectionNode | ChorusReference
          | CommentLine | BlankLine | TabBlock | GridBlock | DelegatedBlock
interface Chord { name: string; root?: string; qualifier?: string; extension?: string; bass?: string; parsed: boolean }
interface Token { /* §8 */ }
interface Warning { line: number; column?: number; code: string; message: string }
```

`ParseOptions`: `chordMode: 'strict' | 'relaxed'` (default `strict`),
`onUnknownDirective: 'warn' | 'ignore'` (default `warn`).

Invariants:
- **Parsing never throws**; records `Warning`s and recovers.
- AST is JSON-serializable and reconstructable.
- `serialize(parse(x))` round-trips meaningful content **including everything in
  the preserve-only tail** — comments, directive order, original chord spellings,
  metadata, legacy/delegated/layout directives. Whitespace normalization allowed
  and documented.
- `KNOWN_DIRECTIVES` / `DIRECTIVE_ALIASES` exported so an app's toolbar is
  data-driven from the library, not a hand-kept copy.

---

## 11. Project structure & tooling

```
chordpro-core/
  src/
    index.ts        # exports grouped by tier, with comments
    model/          # AST types (Tier 1)
    parser/         # line classifier, directive parser, lyric/chord segmenter (Tier 1)
    chords/         # grammar, extension table, transposition (T1) + nashville (T2)
    render/         # text + html string renderers (Tier 1)
    freetext/       # parseFreeText (Tier 2)
    tokenize/       # tokenizer (Tier 2)
    analysis/       # guessKey, chord-shape table (Tier 2)
  test/             # mirrors src/, plus fixtures/ (.cho + free-text samples)
  README.md  FORMAT.md  LICENSE  CHANGELOG.md
  package.json  tsconfig.json
  .github/workflows/ci.yml
```

- **TypeScript** strict mode; ES2020; **zero runtime dependencies**.
- Build ESM + CJS with `.d.ts` (e.g. `tsup`; build-time deps only).
- **Vitest** tests. **ESLint + Prettier** committed config.
- **GitHub Actions** CI: install → typecheck → lint → test on push and PR.
- Package name: **`chordpro-core`** (confirmed available on npm).

---

## 12. Test suite — make it massive

Tests are a primary deliverable. Near-100% coverage of public API; high coverage
of internals. Table-driven for the chord and directive matrices. **Tag tests by
tier** so the Tier-1 suite can be run alone to demonstrate spec conformance.

**Tier 1 — chord parsing (dozens of cases)**
- Every chord in the §5 regression list, strict, decomposed correctly.
- Full spec property table: `C`, `F#`, `Bb`, `Am7`, `C/B`, `Besm`.
- Relaxed: `Coda`→`C`+`oda`, `Gm*`→`G`+`m`+`*`.
- Slash chords, double accidentals, `H` (German), `^`=`maj`.
- Strict failure → `parsed:false`, no throw.
- Parametrized sweep over the **entire** built-in extension list (each forms a
  valid chord on root `C`).

**Tier 1 — directives**
- Every alias normalizes and round-trips to original spelling.
- Long vs short equivalence (`{t:X}` ≡ `{title:X}`).
- Attribute args, both quote styles; positional vs `label="..."`.
- Conditional selectors incl. negation and `define-<instrument>`.
- `x_`-prefixed: preserved, no warning. Unknown non-`x_`: preserved + warning.
- `copyright` extracted (core); `ccli`/`ccli_number` extracted (Tier-2 marked).
- Sections nest; `chorus` shorthand → `ChorusReference`.
- Tab verbatim; grid parses bar structure.
- **Preserve-only tail:** legacy font/colour directives, delegated
  ABC/Lilypond/SVG blocks, and layout directives all survive
  `serialize(parse(x))` unchanged in content and order. (Dedicated round-trip
  tests — this is the headline guarantee of the policy in §0.)

**Tier 1 — transposition**
- `Am7`+2→`Bm7`; `C/B`+2→`D/C#` and (flats) `D/Db`; +n then −n identity.
- Annotations/unparsed untouched.

**Tier 1 — rendering**
- `renderText` alignment matches the spec's chords-over-lyrics example.
- `renderHtml` emits documented classes; chorus/tab distinct.

**Tier 1 — robustness (never-throw)**
- Unclosed `{title: x`, unclosed `[D low`, stray `}`/`]`, mixed `\n`/`\r\n`,
  enormous line, empty file, file of only comments — all recover with warnings.

**Tier 1 — round-trip**
- `serialize(parse(x))` preserves comments, order, chord spellings, metadata,
  and the entire preserve-only tail.

**Tier 2 — free-text parser (many cases)**
- Title/artist detection; metadata lines (`Key/Tempo/BPM/Capo/Time/CCLI` + `Tom:`).
- English + Portuguese headings → correct env pairs.
- Chord-above-lyrics merge incl. misaligned columns, leading/trailing chords.
- Chord-only-line threshold (lyric line with stray capital is NOT chords).
- Key auto-detect fires only at ≥2 occurrences.
- Output re-parses with zero warnings.
- Edge: empty, only-metadata, only-lyrics, mixed line endings.

**Tier 2 — tokenizer**
- Offsets exactly tile the source (property test over fixtures).
- Each token type emitted for the right construct; annotation vs chord; metadata
  vs section vs generic directive; `#` comments.

**Tier 2 — Nashville / key / shapes**
- Nashville round-trip in a key; sharp/flat degree mapping. (Or stub tests if
  stubbed per §6.)
- `guessKey` on known songs; threshold behavior.
- `getChordShape` correct for common guitar+ukulele chords and a `{define}`d
  chord; `null` for unknown.

---

## 13. Documentation

- **README.md**: what it is — a **reference implementation of ChordPro parsing,
  model, and transposition**, plus clearly-labelled **auxiliary helpers**. State
  the guiding policy from §0 verbatim. State the "a renderer, not the renderer"
  caveat. Install; quick-start (parse → transpose → tokenize → render); full API
  grouped by tier; supported directives; strict/relaxed modes; free-text rules;
  non-goals; contributing.
- **TSDoc** on every export; mark Tier-2 exports with an `@remarks` note that they
  are helpers, not part of the format.
- **FORMAT.md**: the implemented subset, in your own words from the public
  specification — self-documenting and clearly an independent implementation.
- **CHANGELOG.md** seeded with `0.1.0`.

---

## 14. Licensing & repository

- License: **MIT**. `LICENSE` with standard MIT text (year + author) and SPDX
  `"license": "MIT"` in `package.json`.
- Implement **solely from the public ChordPro File Format Specification** and this
  document. Do not copy code from any existing ChordPro implementation. This keeps
  the MIT licensing clean and the work independent.
- `git init`, well-scoped commits (`feat: chord parser strict/relaxed`,
  `feat: free-text parser`, `test: preserve-only round-trip`, …), ready to push
  to a public GitHub repo under the author's account.

---

## 15. Suggested build order

Tier 1 first — it is the reference core and the thing the project is named for.
Tier 2 layered after, and explicitly skippable/stubbable for v1 if time is short.

1. `model/` AST types.
2. `parser/`: line classifier + directive parser (aliases, selectors, attrs,
   **preserve-only tail**), warnings, `serialize` — get round-trip green early,
   including the preserve-only tests.
3. Lyric/chord segmenter (inline chords, annotations, tab literal).
4. `chords/`: grammar + extension table (strict/relaxed) — pass the §5 regression
   list and the full-extension sweep.
5. Transposition.
6. `render/`: text then html string renderers.
   — **Tier 1 complete here. The project can credibly ship as a parsing/model/
   transposition reference at this point.**
7. `freetext/`: `parseFreeText`.
8. `tokenize/`.
9. `analysis/`: `guessKey`, chord-shape table; Nashville (or stubs).
10. README, FORMAT.md, LICENSE, CI, package config.
11. Final pass: typecheck, lint, coverage, polish.

Build incrementally; run tests at each step; keep commits focused.

---

## 16. Integration note for a consuming app (informational — do not build here)

A consuming app replaces its duplicated parsing sites with imports:
- renderer consumes `parse` + the AST (or `renderHtml`);
- file parser / format converter call `parse`/`serialize`;
- a "Simple" input mode calls `parseFreeText`;
- a syntax-highlight overlay calls `tokenize` and maps token types to its own
  theme classes;
- a directive toolbar reads `KNOWN_DIRECTIVES` / `DIRECTIVE_ALIASES`.

The library ships none of those UI pieces. That boundary is the point: the engine
is reusable and testable; the app keeps only what is genuinely app-specific
(components, styling, i18n, tab UX).
