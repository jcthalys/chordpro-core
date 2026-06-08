# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] — Spec completeness, Nashville, chord shapes, pre-release audit

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
