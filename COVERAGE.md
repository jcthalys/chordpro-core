# Coverage Audit — `chordpro-core`

Hardening-pass audit against SPEC.md §0–§9.
**Legend:** ✅ = implemented + tested | 🟡 = preserve-only + tested | ⚠️ = gap | ❌ = missing

---

## Line types

| Construct | Implemented? | Round-trips? | Tested? |
|-----------|-------------|-------------|---------|
| Blank line | ✅ behavior | ✅ | ✅ |
| Comment (`#`) | ✅ behavior | ✅ | ✅ |
| Directive | ✅ behavior | ✅ | ✅ |
| Lyric with chords | ✅ behavior | ✅ | ✅ |

---

## Directives — metadata (all Tier 1)

| Directive | Aliases | Extracted? | Round-trips? | Tested? |
|-----------|---------|-----------|-------------|---------|
| `title` | `t` | ✅ | ✅ | ✅ |
| `sorttitle` | — | ✅ | ✅ | ✅ |
| `subtitle` | `st` | ✅ | ✅ | ✅ |
| `artist` | — | ✅ | ✅ | ✅ |
| `sortartist` | — | ✅ | ✅ | ✅ |
| `composer` | — | ✅ | ✅ | ✅ |
| `lyricist` | — | ✅ | ✅ | ✅ |
| `copyright` | — | ✅ | ✅ | ✅ |
| `album` | — | ✅ | ✅ | ✅ |
| `year` | — | ✅ | ✅ | ✅ |
| `key` | — | ✅ | ✅ | ✅ |
| `time` | — | ✅ | ✅ | ✅ |
| `tempo` | — | ✅ | ✅ | ✅ |
| `duration` | — | ✅ | ✅ | ✅ |
| `capo` | — | ✅ | ✅ | ✅ |
| `meta` | — | ✅ (key/value form) | ✅ | ✅ |
| `tag` | — | ✅ (multi-value) | ✅ | ✅ |

## Tier-2 metadata convenience directives

| Directive | Maps to | Tested? |
|-----------|---------|---------|
| `ccli` | `metadata.ccli` | ✅ |
| `ccli_number` | `metadata.ccli` | ✅ |

---

## Directives — formatting (behavior: typed nodes)

| Directive | Aliases | Behavior | Round-trips? | Tested? |
|-----------|---------|---------|-------------|---------|
| `comment` | `c` | Rendered as text in both renderers | ✅ | ✅ |
| `comment_italic` | `ci` | HTML: `cp-comment-italic` | ✅ | ✅ |
| `comment_box` | `cb` | HTML: `cp-comment-box` | ✅ | ✅ |
| `highlight` | — | 🟡 Preserved, no special rendering | ✅ | ✅ |
| `image` | — | 🟡 Attributes parsed and preserved | ✅ | ✅ |

---

## Directives — environments

| Environment | Open | Close | Kind | Label? | Delegated? | Tested? |
|------------|------|-------|------|--------|-----------|---------|
| Chorus | `start_of_chorus` (`soc`) | `end_of_chorus` (`eoc`) | `chorus` | ✅ | ❌ | ✅ |
| Verse | `start_of_verse` (`sov`) | `end_of_verse` (`eov`) | `verse` | ✅ | ❌ | ✅ |
| Bridge | `start_of_bridge` (`sob`) | `end_of_bridge` (`eob`) | `bridge` | ✅ | ❌ | ✅ |
| Pre-chorus | `start_of_prechorus` | `end_of_prechorus` | `prechorus` | ✅ | ❌ | ✅ |
| Pre-chorus (alt) | `start_of_pre_chorus` | `end_of_pre_chorus` | `prechorus` | ✅ | ❌ | ✅ |
| Tab | `start_of_tab` (`sot`) | `end_of_tab` (`eot`) | `tab` | ✅ | ❌ | ✅ |
| Grid | `start_of_grid` (`sog`) | `end_of_grid` (`eog`) | `grid` | ✅ | ❌ | ✅ |
| ABC | `start_of_abc` | `end_of_abc` | `abc` | ✅ | ✅ | ✅ |
| Lilypond | `start_of_ly` | `end_of_ly` | `ly` | ✅ | ✅ | ✅ |
| SVG | `start_of_svg` | `end_of_svg` | `svg` | ✅ | ✅ | ✅ |
| Text block | `start_of_textblock` | `end_of_textblock` | `textblock` | ✅ | ✅ | ✅ |
| Custom `start_of_*` | any `start_of_X` | `end_of_X` | `custom` | ✅ | ❌ | ✅ |

**Standalone `{chorus}`:** → `ChorusReference` node ✅ tested

---

## Directives — chord definitions

| Directive | Behavior | Round-trips? | Tested? |
|-----------|---------|-------------|---------|
| `define` | 🟡 Preserved as directive; `getChordShape()` can parse it | ✅ | ✅ |
| `chord` | 🟡 Same as `define` | ✅ | ✅ |

Note: Structured parsing of `{define}` arguments is handled in `getChordShape()` (Tier 2 analysis).

---

## Directives — transposition

| Directive | Behavior | Tested? |
|-----------|---------|---------|
| `transpose` | 🟡 Preserved as directive. Programmatic transposition via `transpose()` API. | ✅ |

The `{transpose: N}` in-song directive is preserved but not applied automatically during parsing.
The `transpose()` function provides the programmatic equivalent on the full song or any subtree.

---

## Directives — output/layout/legacy (all preserve-only)

| Directive | Aliases | Round-trips? | Tested? |
|-----------|---------|-------------|---------|
| `new_song` | `ns` | ✅ | ✅ |
| `new_page` | `np` | ✅ | ✅ |
| `new_physical_page` | `npp` | ✅ | ✅ |
| `column_break` | `colb` | ✅ | ✅ |
| `columns` | `col` | ✅ | ✅ |
| `grid` | `g` | ✅ | ✅ |
| `no_grid` | `ng` | ✅ | ✅ |
| `titles` | — | ✅ | ✅ |
| `diagrams` | — | ✅ | ✅ |
| `pagetype` | — | ✅ | ✅ |
| `textfont` | — | ✅ | ✅ |
| `textsize` | — | ✅ | ✅ |
| `textcolour` / `textcolor` | — | ✅ | ✅ |
| `chordfont` | — | ✅ | ✅ |
| `chordsize` | — | ✅ | ✅ |
| `chordcolour` / `chordcolor` | — | ✅ | ✅ |
| `titlefont` | — | ✅ | ✅ |
| `titlesize` | — | ✅ | ✅ |
| `titlecolour` / `titlecolor` | — | ✅ | ✅ |
| `subtitlefont` | — | ✅ | ✅ |
| `subtitlesize` | — | ✅ | ✅ |
| `subtitlecolour` / `subtitlecolor` | — | ✅ | ✅ |
| `tabfont` | — | ✅ | ✅ |
| `tabsize` | — | ✅ | ✅ |
| `tabcolour` / `tabcolor` | — | ✅ | ✅ |

---

## Conditional selectors

| Feature | Behavior | Tested? |
|---------|---------|---------|
| `-selector` suffix | `directive.selector = 'name'` | ✅ |
| `-selector!` negation | `directive.negated = true` | ✅ |
| Selector on end directive | Warning `SELECTOR_ON_END_DIRECTIVE` | ✅ |
| Round-trip selector | Original source preserved | ✅ |

---

## Custom `x_` directives

| Feature | Behavior | Tested? |
|---------|---------|---------|
| `x_`-prefixed directives | Preserved, no warning | ✅ |
| Multiple `x_` directives | All preserved in order | ✅ |
| Round-trip | Original source preserved | ✅ |

---

## Unknown directives

| Behavior | Tested? |
|---------|---------|
| Unknown non-`x_` → warning (`UNKNOWN_DIRECTIVE`) | ✅ |
| Unknown still preserved in model | ✅ |
| `onUnknownDirective: 'ignore'` suppresses warning | ✅ |

---

## Chords

| Feature | Behavior | Tested? |
|---------|---------|---------|
| Roots A–G + H (German) | ✅ parsed | ✅ |
| Flat accidentals (`Bb`, `Eb`) | ✅ parsed | ✅ |
| Sharp accidentals (`F#`, `C#`) | ✅ parsed | ✅ |
| Solfège alternates (`Bes`, `Es`, `As`, `Cis`, etc.) | ✅ parsed | ✅ |
| Minor qualifiers (`m`, `mi`, `min`, `-`) | ✅ longest-first | ✅ |
| Augmented (`aug`, `+`) | ✅ parsed | ✅ |
| Diminished (`dim`, `0`) | ✅ parsed | ✅ |
| Diminished 7th (`dim7`) | ✅ parsed | ✅ |
| Half-dim (`h`, `h7`, `h9`) | ✅ parsed | ✅ |
| Major extensions (`maj7`, `^7`, etc.) | ✅ full table | ✅ |
| Minor extensions (`m7b5`, `mmaj7`, etc.) | ✅ | ✅ |
| Slash / bass note (`C/B`, `Fmaj7/A`) | ✅ | ✅ |
| Annotation `[*text]` | ✅ not parsed as chord | ✅ |
| Strict mode failure → `parsed:false` | ✅ never throws | ✅ |
| Relaxed mode any trailing text | ✅ | ✅ |
| Full extension sweep (~140 entries) | ✅ all forms | ✅ |

---

## Inline chord placement

| Position | Tested? |
|----------|---------|
| Start of line | ✅ |
| End of line (empty trailing lyric) | ✅ |
| Mid-word | ✅ |
| Multiple chords per line | ✅ |
| Plain lyric (no chords) | ✅ |
| Chord inside tab block → literal, not parsed | ✅ |

---

## Transposition

| Feature | Tested? |
|---------|---------|
| `transposeChord` — all 12 semitones (sharps) | ✅ |
| `transposeChord` — all 12 semitones (flats) | ✅ |
| Sharp/flat preference inferred from root | ✅ |
| `preferSharps` / `preferFlats` options | ✅ |
| Qualifier preserved (`Am7 → Bm7`) | ✅ |
| Extension preserved | ✅ |
| Bass note transposed (`C/B → D/C#`) | ✅ |
| Unparsed chords pass through | ✅ |
| Annotations pass through | ✅ |
| `+n then -n` identity (with default opts) | ✅ |
| Song-level `transpose()` | ✅ |
| Key metadata transposed (qualifier preserved: `Am → Bm`) | ✅ |
| Grid row chords transposed | ✅ |
| Tab blocks skipped | ✅ |
| Delegated sections skipped | ✅ |
| Song immutable (original unchanged) | ✅ |

---

## Rendering

| Feature | Tested? |
|---------|---------|
| `renderText` — chords above lyrics alignment | ✅ |
| `renderText` — tab verbatim | ✅ |
| `renderText` — grid rows | ✅ |
| `renderText` — delegated sections | ✅ |
| `renderText` — comment directives | ✅ |
| `renderText` — section labels | ✅ |
| `renderText` — header (title/artist/key) | ✅ |
| `renderHtml` — all documented class names | ✅ |
| `renderHtml` — HTML escaping | ✅ |
| `renderHtml` — no inline styles | ✅ |

---

## Free-text parser (Tier 2)

| Feature | Tested? |
|---------|---------|
| Title extraction (first content line) | ✅ |
| Artist extraction (second content line) | ✅ |
| `Key:` / `Tom:` metadata | ✅ |
| `Tempo:` / `BPM:` metadata | ✅ |
| `Capo:` metadata | ✅ |
| `CCLI:` metadata | ✅ |
| English section headings (Verse/Chorus/Bridge/Pre-Chorus) | ✅ |
| Portuguese headings (Verso/Refrão/Coro/Ponte) | ✅ |
| Bracketed headings (`[Bridge]`) | ✅ |
| Chord-above-lyrics merge | ✅ |
| 80% threshold (lyric with capital ≠ chord line) | ✅ |
| Key auto-detection (≥2 occurrences) | ✅ |
| Output re-parses with zero unknown warnings | ✅ |
| Empty input | ✅ |
| Only-metadata input | ✅ |
| Mixed line endings | ✅ |

---

## Tokenizer (Tier 2)

| Feature | Tested? |
|---------|---------|
| Offset tiling (concatenate → exact source) | ✅ |
| `metadata-directive` for `{title}` / `{key}` | ✅ |
| `section-open` for `{start_of_*}` / `{chorus}` | ✅ |
| `section-end` for `{end_of_*}` | ✅ |
| `directive` for other directives | ✅ |
| `chord` for `[G]` | ✅ |
| `annotation` for `[*Coda]` | ✅ |
| `comment` for `# ...` | ✅ |
| `lyric` for plain text | ✅ |
| Unclosed bracket → graceful recovery | ✅ |
| Empty source | ✅ |
| Consecutive directives | ✅ |

---

## Analysis helpers (Tier 2)

| Feature | Tested? |
|---------|---------|
| `guessKey` — detects key from chord frequency | ✅ |
| `guessKey` — returns null for no chords | ✅ |
| `guessKey` — returns null for < 2 occurrences | ✅ |
| `guessKey` — accepts Song object | ✅ |
| `guessKey` — confidence 0-1 | ✅ |
| `getChordShape` — guitar common open chords | ✅ |
| `getChordShape` — ukulele common open chords | ✅ |
| `getChordShape` — returns null for unknown | ✅ |
| `getChordShape` — song-defined `{define}` chords | ✅ |
| `getChordShape` — with / without `fingers` | ✅ |
| `toNashville` / `fromNashville` — stub passthrough | ✅ |

---

## Corpus / round-trip

| Fixture | Parse? | Round-trips? | Tokenizer tiles? |
|---------|--------|-------------|-----------------|
| `amazing_grace.cho` | ✅ | ✅ | ✅ |
| `freetext_sample.txt` (via parseFreeText) | ✅ | ✅ | — |
| `ballad_with_bridge.cho` | ✅ | ✅ | ✅ |
| `jazz_chords.cho` | ✅ | ✅ | ✅ |
| `delegated_environments.cho` | ✅ | ✅ | ✅ |
| `all_metadata.cho` | ✅ | ✅ | ✅ |
| `selectors_and_defines.cho` | ✅ | ✅ | ✅ |

---

## Coverage metrics (post hardening-pass)

| Metric | Result | Threshold |
|--------|--------|-----------|
| Statements | 92.85% | ≥ 80% |
| Branches | 84.28% | ≥ 75% |
| Functions | 96.42% | ≥ 80% |
| Lines | 95.25% | ≥ 80% |
| Tests | 561 | — |
| Test files | 10 | — |

### Deliberate gaps

- `nashville.ts` — v1 stubs (typed signatures, passthrough behavior); marked in code.
- `renderText.ts` lines 60,68,97 — edge-case rendering paths; now tested.
- `parseChord.ts` lines 127-128 — strict-mode failure for `maj*` unknown extensions; tested.
- `chordShapes.ts` — seed table is purposefully small; table growth planned post-v1.

---

## Public API completeness

All exports from the spec's §10 public API table are present and tested:

| Export | Present? | TSDoc? | Tested? |
|--------|---------|--------|---------|
| `parse` | ✅ | ✅ | ✅ |
| `serialize` | ✅ | ✅ | ✅ |
| `parseChord` | ✅ | ✅ | ✅ |
| `transpose` | ✅ | ✅ | ✅ |
| `transposeChord` | ✅ | ✅ | ✅ |
| `renderText` | ✅ | ✅ | ✅ |
| `renderHtml` | ✅ | ✅ | ✅ |
| `DIRECTIVE_ALIASES` | ✅ | ✅ | ✅ |
| `KNOWN_DIRECTIVES` | ✅ | ✅ | ✅ |
| `parseFreeText` | ✅ | ✅ | ✅ |
| `tokenize` | ✅ | ✅ | ✅ |
| `guessKey` | ✅ | ✅ | ✅ |
| `getChordShape` | ✅ | ✅ | ✅ |
| `toNashville` | ✅ (stub) | ✅ | ✅ |
| `fromNashville` | ✅ (stub) | ✅ | ✅ |
| All AST types | ✅ | ✅ | — |

---

_Generated during the hardening pass. Update when new features or spec revisions are added._
