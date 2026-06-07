# Build prompt: `chordpro-core` — full coverage hardening pass

> **Run this before the playground.** Tier 1 and Tier 2 are implemented. The goal
> now is to verify and close any gaps so the library is a genuinely complete,
> spec-faithful implementation with a thorough test suite — *before* a UI is
> built on top of it. Work against SPEC.md (the authoritative spec) and the
> public ChordPro File Format Specification.

## Objective

Make `chordpro-core` complete and trustworthy:
1. Every construct in the ChordPro format is recognized and round-trips
   losslessly (the "parse-and-preserve everything" policy in SPEC.md §0).
2. Every behavior the spec defines for the well-defined subset is implemented
   and correct.
3. The test suite genuinely exercises all of it, with measured coverage.

Do this as an **audit → fill gaps → prove with tests** pass, not a rewrite. Keep
the existing architecture and the Tier 1 / Tier 2 boundary intact.

## Step 1 — Audit against the spec

Produce a short `COVERAGE.md` audit table before changing code. For each item in
the format, record: implemented? (behavior vs preserve-only), round-trips
losslessly? (yes/no), tested? (yes/no). Cover at minimum:

- **Line types:** blank, comment (`#`), directive, lyric-with-chords.
- **Every directive** listed in SPEC.md §2, including the preserve-only tail:
  - meta-data (all of them, long + short names)
  - formatting (comment / comment_italic / comment_box / highlight / image)
  - environments (chorus + reference, verse, bridge, prechorus, tab, grid)
  - delegated environments (abc, ly, svg, textblock) — preserve-only
  - chord definitions (define, chord)
  - transpose
  - output/layout/legacy (new_page, new_physical_page, column_break, columns,
    font/size/colour family, grid/no_grid, titles, diagrams, pagetype)
  - conditional selectors (`-selector`, negation `!`) on directives
  - custom `x_` directives (preserved, no warning)
- **Chords:** root systems (A–G, H), accidentals, qualifiers, the full built-in
  extension list, slash/bass, annotations `[*...]`, strict vs relaxed.
- **Inline chord placement:** start of line, end of line, mid-word, multiple per
  line.
- **Transposition:** all 12 semitones, sharp/flat preference, slash chords,
  identity round-trip.

Flag every row that is missing behavior, loses data on round-trip, or lacks a
test.

## Step 2 — Close the gaps

For every flagged row:
- If a construct isn't recognized or drops data → fix the parser/serializer so it
  round-trips losslessly. **Nothing in the format may be silently dropped.**
- If defined behavior is missing or wrong → implement/correct it.
- Keep preserve-only constructs preserve-only (don't invent rendering semantics)
  — but they MUST survive `serialize(parse(x))` unchanged in content and order.

## Step 3 — Test to completion

- Add tests for every gap found, plus broaden the existing matrices:
  - **Table-driven chord sweep:** every entry in the built-in extension list
    forms a valid chord (on multiple roots, not just C), strict mode.
  - **Directive matrix:** every directive, both long and short forms, with and
    without arguments/attributes, with and without conditional selectors.
  - **Round-trip property test:** for a corpus of fixture songs (and ideally some
    randomized/fuzzed inputs), `parse → serialize → parse` is stable and
    lossless for meaningful content.
  - **Tokenizer property test:** concatenated token `text` exactly reproduces the
    source, for every fixture.
  - **Never-throw fuzz:** feed malformed/garbage/huge/empty/binary-ish input;
    assert it never throws and always returns warnings + partial output.
  - **Free-text matrix:** all detection rules, EN + PT headings, misaligned
    chord-over-lyric merges, threshold edge cases.
- **Add coverage measurement** to the test setup (Vitest coverage / c8). Target:
  - Tier 1 (format core): as close to 100% as practical; no untested public
    function, no untested directive branch.
  - Overall: high coverage; document any deliberate gaps in COVERAGE.md.
- Add a `coverage` script and wire coverage into the CI workflow (fail CI under a
  sensible threshold).

## Step 4 — Real-world corpus

- Add a `test/fixtures/corpus/` of real-world-style `.cho` files exercising the
  breadth above (don't copy any third party's proprietary songbook — use public
  examples or hand-written ones). Run the full parse → serialize → parse
  round-trip over the whole corpus as a single test, asserting losslessness and
  zero unexpected warnings.

## Step 5 — Report

- Update `COVERAGE.md` with the final state: every row implemented/preserved and
  tested, with the coverage numbers.
- Update `CLAUDE.md` status line (e.g. "Tier 1 + Tier 2 complete; full spec
  coverage verified; playground next").
- Update `CHANGELOG.md`.
- Commit in focused chunks (audit doc, gap fixes per area, test additions,
  coverage wiring).

## Constraints (unchanged)

- TypeScript strict, zero runtime deps, MIT, never-throw.
- Keep the Tier 1 / Tier 2 separation and the public API stable. If the audit
  reveals the public API is missing something a real consumer needs, note it in
  COVERAGE.md and propose the addition explicitly — don't silently reshape the
  API.
- Implemented solely from the public ChordPro specification; copy no other
  implementation's code.

## What success looks like

A `COVERAGE.md` showing every format construct recognized + round-tripping +
tested; Tier 1 coverage at/near 100%; a corpus round-trip test passing; CI
enforcing a coverage threshold. At that point the library is ready for the
playground (run `chordpro-core-playground-prompt.md` next).
