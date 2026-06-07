# Changelog

All notable changes to this project will be documented in this file.

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
