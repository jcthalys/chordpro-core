# chordpro-core

A dependency-free TypeScript **reference implementation of the ChordPro file
format** — parsing, data model, and transposition — plus clearly-separated
auxiliary helpers (free-text parser, tokenizer, key detection, chord shapes,
Nashville).

The full build specification is in **SPEC.md** — read it before implementing or
changing anything.

## Guiding policy

Recognize and round-trip the entire format; implement semantics only for the
well-defined subset; never silently drop anything. (See SPEC.md §0.)

## Working agreement

- TypeScript strict mode, target ES2020, **zero runtime dependencies**.
- Build ESM + CJS with type declarations; Vitest for tests; ESLint + Prettier.
- **MIT** licensed. Implemented solely from the public ChordPro specification —
  never copy code from any other ChordPro implementation.
- **Tier 1 (format core) first**, Tier 2 helpers after. Tier 1 = parse,
  serialize, chords, transposition, renderers. Tier 2 = parseFreeText, tokenize,
  guessKey, getChordShape, Nashville. (See SPEC.md §0 and §15.)
- No UI, no DOM, no framework, no styling anywhere in this package.
- Parsing never throws — record warnings and recover.
- Write tests alongside each module; keep commits small and focused.

## Structure

```
src/model · src/parser · src/chords · src/render   (Tier 1)
src/freetext · src/tokenize · src/analysis          (Tier 2)
test/ mirrors src/, fixtures in test/fixtures
```

## Status

**Tier 1 + Tier 2 complete; playground deployed. See COVERAGE.md for full spec audit.**

- 561 tests, 10 test files — all passing
- Coverage: 92.8% statements / 84.3% branches / 96.4% functions / 95.3% lines
- TypeScript strict, ESLint, build — all clean

## Key implementation details (for future sessions)

- **Chord parser backtracking**: tries longest roots first, falls back on invalid rest. Solves `Esus2` vs `Es+us2`, `Bbmaj7` vs `Bb+m+aj7` ambiguities.
- **`maj`/`^` guard** in `parseQualExt`: checks `startsWith('maj'|'^')` before trying minor qualifier `m` — prevents `m` eating `maj7`.
- **`isChordOnlyLine` in `parseFreeText` uses strict mode** — prevents regular words like "Amazing" (starts with 'A') from being treated as chord tokens.
- **Grid rows store `source`** for lossless round-trip; source is cleared after transposition so rebuilt from cells.
- **Key transposition preserves qualifier**: `Am` + 2 semitones → `Bm`, not `B`.
- **Custom `start_of_*`/`end_of_*`** directives recognized as `kind: 'custom'` sections (not unknown directives).
- **`exactOptionalPropertyTypes: true`** — use conditional assignment for optional fields, not spread with `| undefined`.
- **`ignoreDeprecations: "6.0"`** in tsconfig — required for TS6 compat with tsup's DTS builder.

## Commands

```sh
npm test           # run all tests
npm run coverage   # tests + coverage (enforces 80% threshold)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src
npm run build      # tsup ESM+CJS+.d.ts
npm run ci         # typecheck + lint + coverage
```
