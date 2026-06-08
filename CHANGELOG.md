# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] — Brazilian/Portuguese chord sheet support + sounding key

### New Tier 1 APIs

- **`soundingKey(song): string | null`** — returns the key a song sounds in after
  capo transposition. Reads `{key}` and `{capo}` from metadata; returns `null` when
  no key is set; returns the key unchanged when capo is 0 or absent. Accidental
  preference follows the written key (flat keys stay flat).
- **`soundingKeyOf(key, capo): string`** — lower-level helper; transposes a key
  string up by a given number of semitones. Preserves minor qualifier; derives
  accidental preference from the original key spelling.

### Tier 2 — `parseFreeText` improvements

**Extended Brazilian/Portuguese metadata detection.** All of the following are
now recognized (case-insensitive; colon optional where noted):

- Combined key+capo forms: `Tom: A (Capo 2)`, `Tom com Capo 2: G`, `Tom (Capo 2): G`
- `Tom real: X` → `{meta: tom_real X}`; `Afinação: X` / `Afinacao: X` → `{meta: afinacao X}`
- `Capo N` (without colon)
- `Andamento: X` — numeric → `{tempo: N}`, text → `{meta: andamento X}`
- `Ritmo: X` → `{meta: ritmo X}`
- `Compasso: N/N` → `{time: N/N}`; `Fórmula de compasso: N/N` → same
- `Artista:`, `Título:`/`Titulo:`, `Álbum:`/`Album:`, `Ano:`, `Compositor:`/`Composição:`,
  `Letrista:`, `Copyright:` → respective standard ChordPro metadata directives

**Extended section heading detection.** Added: `Estrofe [N]`, `Coro`, `Pré-Refrão`/`Pre-Refrao`,
`Pré-Coro`/`Pre-Coro`, `Pre-Chorus`, `Intro`/`Introdução`/`Introducao`/`Abertura`,
`Outro`/`Final`/`Finalização`/`Coda`, `Solo [N]`, `Instrumental`, `Riff [N]`,
`Interlúdio [N]`/`Interludio [N]`. All accept optional brackets, colon, and number suffix.

**Repeat annotation handling.** `(x2)`, `(2x)`, `(N vezes)`, `(repete N)`, `(repeat N)`, etc.:
- On a section heading line → `{meta: repeat N}` emitted first inside the section
- On a standalone line → `{comment: (xN)}`
- At the end of a lyric line → `[*xN]` annotation

**Unicode-aware chord-above-lyrics column alignment.** The chord merger now uses
code-point iteration (`[...str]`) for position measurement, which is correct for
non-BMP characters (surrogate pairs / emoji) in chord or lyric lines.

**Explicit `Artista:` / `Título:` metadata lines now suppress auto title/artist
detection** from subsequent free-text lines (consistent with the explicit value taking
priority).

### Documentation

- README: documents `soundingKey` / `soundingKeyOf` in the Tier 1 API section.
- README: extends the `parseFreeText` section with full metadata and section heading tables.
- FORMAT.md: documents the `{meta: repeat N}` convention for repeat annotations.

### Tests

- `soundingKey` / `soundingKeyOf` — table-driven across all 12 capo positions × multiple key types.
- `parseFreeText` — one test per new metadata pattern.
- `parseFreeText` — one test per new section heading variant.
- `parseFreeText` — repeat annotations: heading, standalone, end-of-lyric.
- `parseFreeText` — accent-aware alignment with Portuguese lyrics.
- `test/fixtures/brazilian/evidencias.test.ts` — complete Cifra Club–style paste fixture
  with 24 assertions covering all metadata, sections, repeat counts, chord merging, and
  round-trip re-parse.
- Total: 805 tests, all passing.

---

## [0.2.0] — Spec completeness, Nashville, chord shapes, pre-release audit

### Breaking changes (0.x)

These are **behavioral changes** to existing Tier 2 helpers. No Tier 1 format
constructs (parse, serialize, transpose, render) are affected.

- **`guessKey` return value for minor keys changed.**
  Previously the function returned the most-frequent root as a plain note name
  (e.g. `"A"` for A minor). It now returns a qualified key string, matching the
  ChordPro `{key}` metadata convention:
  ```
  // Before 0.2.0
  guessKey('[Am]a [G]b [F]c [G]d [Am]e').key  // → "A"
  // 0.2.0+
  guessKey('[Am]a [G]b [F]c [G]d [Am]e').key  // → "Am"
  ```
  Consumers that compared `result.key === 'A'` for A minor must update to
  `result.key === 'Am'` (or check `result.key.startsWith('A')`).

- **`parseFreeText` key inference follows `guessKey` behavior.**
  `parseFreeText` key auto-detection was rewired to call `guessKey` instead of
  its own naïve root-frequency counter. As a consequence, inferred keys in the
  `parseFreeText` output now also use the qualified minor format (`"Am"`, `"Em"`)
  and use diatonic-coverage scoring (more accurate, but may differ from the old
  counter on songs where the previous result was wrong).

### New Tier 1 APIs
- **`applyTransposeDirectives(song)`** — applies in-song `{transpose: N}` directives to
  all subsequent chord content; called automatically by `renderText` / `renderHtml`
- **`ChordDef` model node** — `{define}` and `{chord}` directives now emit a structured
  `ChordDef` node instead of a generic `DirectiveLine`. Fields: `name`, `baseFret`, `frets`,
  `fingers`, `keys`, `copy`, `copyAll`, `display`, `source`
- **`resolveChorus(song, ref)`** — resolves a `ChorusReference` to the last matching
  `SectionNode` that precedes it in document order (spec rule: last definition before)
- **`collectChorusCandidates(song, ref)`** — returns all matching chorus sections before ref

### New / changed Tier 2 APIs
- **`toNashville(song, key)` / `fromNashville(song, key)`** — fully implemented (was a stub).
  Converts chord roots to scale degrees (1–7) with `b`-prefix for chromatic tones
  (F in G → `b7`, Bb in G → `b3`). `fromNashville(toNashville(song, key), key)` is
  identity on all diatonic chord names
- **`guessKey`** — replaced naïve root-frequency counter with diatonic coverage scoring
  over all 24 candidate keys (12 major + 12 minor). Now returns minor keys as `"Am"` not
  `"A"` (**breaking change** for consumers comparing the key string)
- **`getChordShape`** — guitar shapes expanded from 24 to 110+ entries; ukulele from 21
  to 55+. Covers: all natural + accidental major/minor, dominant 7th, major 7th, minor 7th,
  suspended, add9, 9th, diminished, augmented, 6th, power chords. Adds algorithmic
  E-shape / A-shape barre fallback for any major/minor chord not in the static table.
  Fixed data bugs in F, Fm, Cm entries (arrays were reversed or used wrong convention)
- **`parseFreeText` key auto-detection** — now uses `guessKey` (diatonic scoring) instead
  of naïve frequency count, for consistent results with the standalone helper

### Font/size/colour directive families (issue #1)
- Added 20 missing directives: `chorusfont/size/colour/color`, `footerfont/size/colour/color`,
  `gridfont/size/colour/color`, `labelfont/size/colour/color`, `tocfont/size/colour/color`
- Added `cf` → `chordfont` and `cs` → `chordsize` short aliases

### In-song transpose directive (issue #2)
- Renderers now apply `{transpose: N}` directives that appear mid-song
- Supports trailing `s`/`f` for sharps/flats preference: `{transpose: 2s}`, `{transpose: 1f}`
- `{transpose}` (no value) cancels the current transposition

### Playground updates
- Live interactive demos for Nashville, in-song transpose, ChordDef, chorus references
- Key detection section upgraded to reflect new diatonic-scoring behavior
- Removed all "v1 stub" messaging

### Bug fixes
- Removed unused imports (`SectionNode` in `nashville.ts`, `Line` in `resolveChorus.ts`)
  that caused `npm run ci` to fail

### Tests
- 684 tests (up from 561 at v0.1.1)
- GraceNote-critical regression suite added to hardening tests
- Tokenizer CRLF tiling and never-throw fuzz added
- Coverage: 91.2% statements / 82.57% branches / 95% functions (above 80% threshold)

---

## [0.1.2] — Interactive playground

- **playground/** — single-page vanilla TS/HTML app consuming the built library
  - Tabs: Rendered, Text, AST, Tokens, Round-trip, Chord inspector, Free-text, Directives
  - `renderHtml` output with chord-over-lyrics CSS layout applied by the playground
  - Color-coded token display with legend (`tokenize`)
  - Chord diagram SVG generated from `getChordShape` data
  - `parseFreeText` converter with metadata pills and "Load in editor" button
  - `KNOWN_DIRECTIVES` reference table
  - 8 preset examples including a "deliberately broken" sample
  - Live update (200ms debounce); transpose stepper; chord mode + accidental controls
  - Accessible: semantic HTML, labeled controls, keyboard-navigable tabs, dark-mode
  - 28-check smoke test (`node playground/smoke.mjs`) guards API stability
- **GitHub Actions** workflow (`deploy-playground.yml`) builds + deploys to GitHub Pages
- **Root scripts:** `npm run playground`, `npm run playground:build`, `npm run playground:smoke`

## [0.1.1] — Hardening pass

- **Fixes:** Key metadata transposition now preserves qualifier (`Am` + 2 → `Bm`, not `B`)
- **Fixes:** Grid rows store original source text for lossless round-trip
- **Fixes:** Grid row chords are now transposed with the song (were previously skipped)
- **Features:** Custom `start_of_*`/`end_of_*` directives recognized as `kind: 'custom'` sections
- **Tests:** 561 tests (+283 from hardening pass) across 10 test files
- **Tests:** Corpus of 5 real-world-style fixture files with round-trip property tests
- **Tests:** Never-throw fuzz suite (22 malformed/garbage/binary inputs)
- **Tests:** Full directive matrix, extended chord sweep, transposition edge cases
- **Coverage:** 92.8% statements / 84.3% branches / 96.4% functions (threshold enforced in CI)
- **Docs:** `COVERAGE.md` audit table — every spec construct documented as implemented/preserved/tested

## [0.1.0] — Initial release

- Tier 1: ChordPro 6 parser, data model, and transposition (reference implementation)
  - Full directive support with alias normalization and round-trip fidelity
  - Inline chord and annotation parsing
  - Section environments (chorus, verse, bridge, prechorus, tab, grid)
  - Delegated environments (abc, ly, svg, textblock) — preserved verbatim
  - Parse-and-preserve policy: every construct round-trips, nothing is dropped
  - Strict and relaxed chord parsing modes
  - `transposeChord` / `transpose` with sharps/flats preference
  - `renderText` and `renderHtml` string renderers
- Tier 2: Auxiliary helpers (clearly not part of the format)
  - `parseFreeText` — loose human-written sheets → canonical ChordPro
  - `tokenize` — typed tokens for editor syntax highlighting
  - `guessKey` — frequency-based key detection
  - `getChordShape` — chord-name → fingering data (guitar + ukulele)
  - `toNashville` / `fromNashville` — Nashville conversion (v1 stub)
- 278 tests covering both tiers
- Zero runtime dependencies; TypeScript strict mode
