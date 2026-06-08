# Pre-release Audit — chordpro-core

> Conducted 2026-06-08 against `main` (post-merge of all v0.1.x PRs).
> Scope: spec completeness, API stability, quality gates, packaging,
> GraceNote-critical behaviors. Fix-only-defects policy.

---

## Part 1 — Findings

### A. Spec completeness

#### Recognized and round-tripping correctly

| Construct | Recognized | Round-trips | Notes |
|---|---|---|---|
| Blank lines | ✅ | ✅ | |
| Comment lines (`#`) | ✅ | ✅ | Preserved as-is |
| All metadata directives | ✅ | ✅ | title, artist, key, capo, tempo, time, duration, album, year, copyright, composer, lyricist, subtitle, sorttitle, sortartist, meta, tag |
| `{ccli}` / `{ccli_number}` | ✅ | ✅ | Both map to `metadata.get('ccli')`; when both present last-one-wins |
| Inline chords `[G]` | ✅ | ✅ | |
| Annotations `[*text]` | ✅ | ✅ | |
| `{comment}` / `{comment_italic}` / `{comment_box}` | ✅ | ✅ | Rendered; not just preserved |
| Section environments | ✅ | ✅ | chorus, verse, bridge, prechorus, tab, grid |
| Delegated environments | ✅ | ✅ | abc, ly, svg, textblock — rawContent verbatim |
| Custom `start_of_*` / `end_of_*` | ✅ | ✅ | `kind: 'custom'`, no unknown-directive warning |
| `x_`-prefixed directives | ✅ | ✅ | No warning emitted |
| Conditional selectors + negation | ✅ | ✅ | `{name-selector!: arg}` → DirectiveLine.selector + .negated |
| `{define}` / `{chord}` full grammar | ✅ | ✅ | ChordDef: base-fret, frets, fingers, keys, copy, copyall, display |
| `{define-guitar}` / `{define-ukulele}` | ✅ | ✅ | Parsed as ChordDef with selector; source preserved |
| `{chorus}` standalone → ChorusReference | ✅ | ✅ | Labeled `{chorus: label}` also correct |
| `{transpose: N}` directive (in-song) | ✅ | ✅ | `applyTransposeDirectives` applied by renderers |
| Grid rows (`| C | F | G |`) | ✅ | ✅ | source stored; fallback reconstruction after transposition has minor leading-space difference (see §C) |
| Tab lines verbatim | ✅ | ✅ | |
| German `H` root | ✅ | ✅ | In NOTE_ROOTS and ROOT_TO_SEMITONE |
| Solfège spellings (Es, Hes, Cis, etc.) | ✅ | ✅ | |
| Enharmonic equivalents | ✅ | ✅ | All 12 semitones covered in transposition |
| Font/size/colour legacy directives | ✅ | ✅ | 20 families × 4 variants |
| All output-layout directives | ✅ | ✅ | new_page, columns, grid, titles, diagrams, pagetype, etc. |
| Strict chord parsing | ✅ | — | ~140 extensions; maj/^ guard prevents `m` eating `maj7` |
| Relaxed chord parsing | ✅ | — | Any trailing text accepted |
| Slash chords (bass note) | ✅ | ✅ | |
| Transposition: key metadata qualifier | ✅ | — | `Am + 2 → Bm`, not `B` |
| Transposition: grid rows | ✅ | — | Fixed in v0.1.1 |
| Transposition: immutability | ✅ | — | Returns new Song |

#### Spec constructs NOT implemented (deliberate scope decisions)

| Construct | Status | Justification |
|---|---|---|
| `%{key}` metadata interpolation in directive arguments | Not implemented | Render-time concern; app responsibility |
| Reference-program config-file system | Out of scope | Not a format construct |
| PDF / page layout semantics | Out of scope | No rendering surface |
| Delegated environment rendering (ABC→SVG, etc.) | Out of scope | App delegates |

#### Gaps found

**G-1 (minor):** `parseFreeText` key auto-detection still uses the old naïve root-frequency counter from before the `guessKey` improvement. It duplicates the logic instead of calling `guessKey`. This means free-text key inference is less accurate than calling `guessKey` directly. Fix: replace inline counter with a call to `guessKey`.

**G-2 (cosmetic):** `{chorus}` is listed in `KNOWN_DIRECTIVES` with `category: 'environment-open'`. It is not an environment — it creates a `ChorusReference`. The category is slightly misleading but does not affect runtime behavior. Fix: change to a distinct `'chorus-ref'` category in a future pass.

**G-3 (cosmetic):** Grid row fallback serializer (used only after transposition clears `source`) reconstructs without a leading pipe, producing `" | C | F | G | Am | "` for an original `"| C | F | G | Am |"`. Not a lossy round-trip (original source is always preserved pre-transposition), but it's imperfect. Noted; fixing it is future work.

---

### B. Public API — stability and consumer-readiness

#### Full export surface

```
Tier 1:
  parse(source, options?) → Song
  serialize(song) → string
  resolveChorus(song, ref) → SectionNode | null
  collectChorusCandidates(song, ref) → SectionNode[]
  parseChord(name, options?) → Chord
  transpose(song, semitones, options?) → Song
  transposeChord(chord, semitones, options?) → Chord
  applyTransposeDirectives(song) → Song
  renderText(song, options?) → string
  renderHtml(song, options?) → string
  DIRECTIVE_ALIASES: Readonly<Record<string, string>>
  KNOWN_DIRECTIVES: ReadonlyArray<DirectiveInfo>

Tier 2:
  parseFreeText(input) → ParseFreeTextResult
  tokenize(source) → Token[]
  guessKey(input) → KeyGuess | null
  getChordShape(name, instrument, song?) → DiagramData | null
  toNashville(song, key) → Song
  fromNashville(song, key) → Song
  ALL_EXTENSIONS / STRICT_EXTENSIONS / MINOR_EXTENSIONS: Set<string>

Types:
  Song, Line, Chord, Segment, BlankLine, CommentLine, DirectiveLine,
  LyricLine, SectionNode, SectionKind, ChorusReference, TabLine,
  GridRow, GridCell, ChordDef, Warning,
  ParseOptions, TransposeOptions, ChordParseOptions, TextRenderOptions,
  HtmlRenderOptions, ParseFreeTextResult, Token, KeyGuess, DiagramData,
  DirectiveInfo, DirectiveCategory
```

#### GraceNote-critical surface — verified

| Check | Result |
|---|---|
| `parse` / `serialize` / `parseFreeText` / `tokenize` / `transpose` / `parseChord` present | ✅ |
| `KNOWN_DIRECTIVES` / `DIRECTIVE_ALIASES` exported | ✅ |
| Chord regression (strict mode): `Cadd9`, `G7sus4`, `Am7b5`, `Fmaj7/A`, `Dsus2`, `Bbmaj7`, `F#dim7`, `Gaug`, `Esus2`, `Bm7` | ✅ all parse correctly |
| `{copyright}` extracted into `song.metadata.get('copyright')` | ✅ |
| `{ccli}` and `{ccli_number}` → `song.metadata.get('ccli')` | ✅ (last-one-wins when both present) |
| Tokenizer: `tokens.map(t => t.text).join('') === source` | ✅ verified for 6 input classes incl. CRLF and `{unclosed` |
| `parseFreeText` handles `Tom: Am` (Portuguese key label) | ✅ |
| `parseFreeText` handles `Refrão` / `Verso` / `Ponte` headings | ✅ |
| `parse` never throws on garbage/empty/huge input | ✅ fuzz: 6 pathological cases, 0 throws |

#### API stability flags

- `guessKey` now returns minor keys as `"Am"` not `"A"` — this is a **breaking change** from the v0.1.1 stub behavior. Consumers who compared `result.key === 'A'` for A minor will need updating.
- `ChordDef`, `resolveChorus`, `collectChorusCandidates`, `applyTransposeDirectives` are all new additions without stabilization history.
- All other Tier 1 surface is stable and matches the documented API.

---

### C. Quality gates

```
Typecheck:  PASS
Lint:       FAIL — 2 errors (see below)
Tests:      667 PASS / 0 FAIL
Coverage:
  Statements:  90.9%  (1019/1121)  ← was 92.8%
  Branches:    82.26% (677/823)    ← was 84.3%
  Functions:   94.87% (111/117)
  Lines:       93.8%  (893/952)
  Threshold enforced: 80% — all pass, but branch coverage trending down
```

#### Lint errors (release-blocking)

**L-1:** `src/chords/nashville.ts:9` — `SectionNode` imported but never used.  
**L-2:** `src/parser/resolveChorus.ts:9` — `Line` imported but never used.

Both are stale imports from initial implementation. Must be removed before publish.

#### Low-coverage areas

| File | Branch % | Untested paths |
|---|---|---|
| `chordShapes.ts` | 55% | Most entries in expanded static table; barre fallback edge paths |
| `nashville.ts` | 67% | `extractNashvilleRoot` fallback; `chordFromNashville` unparsed branch |
| `parseFreeText.ts` | 73% | Orphan chord line (no following lyric); `lowerToKind` prechorus path |
| `renderHtml.ts` | 77% | Lyric-only line (no chord/annotation); delegated section render path |

#### Untested public functions

- `collectChorusCandidates` has tests but `resolveChorus.ts` branches for sections nested inside sections are not covered (the function only walks top-level `song.lines`, so a chorus inside a verse would not be found — this is correct per spec but the untested branch in coverage is the label-mismatch skip path).

---

### D. Packaging and docs

| Check | Result |
|---|---|
| `exports` field (import/require/types triple condition) | ✅ |
| `files: ["dist"]` | ✅ |
| `prepublishOnly: "npm run build"` | ✅ |
| `npm pack --dry-run`: ships dist only (9 files, no src/test) | ✅ |
| `main` / `module` / `types` fields | ✅ |
| Source maps included | ✅ |
| Zero runtime dependencies | ✅ |
| No prompt/spec scaffolding tracked in git | ✅ |
| Version in `package.json` | ⚠️ `0.1.0` — should be bumped to `0.2.0` given feature scope |
| CHANGELOG | ⚠️ Not updated since v0.1.2 (playground); all subsequent changes undocumented |
| README Nashville description | ⚠️ Still says "v1 stub — returns the song unchanged"; Nashville is now fully implemented |
| README guessKey section | ⚠️ Does not document that minor keys return `"Am"` not `"A"` |

---

## Part 2 — Fixes

### Fixed in this pass

1. **L-1, L-2** — Remove unused imports (`SectionNode` from nashville.ts, `Line` from resolveChorus.ts). Unblocks CI.
2. **G-1** — `parseFreeText` key auto-detection: replace inline naive counter with a call to `guessKey`. Uses the improved diatonic-coverage scoring for consistency.
3. **Coverage** — Add targeted tests for: barre chord fallback paths; nashville unparsed-chord branch; parseFreeText orphan chord line; tokenizer CRLF tiling.
4. **Version** — Bump to `0.2.0` in package.json.
5. **CHANGELOG** — Document all changes since v0.1.2.
6. **README** — Remove "v1 stub" Nashville language; update guessKey minor-key behavior note.

### Not fixed (future work)

- **G-2** (`{chorus}` category label) — cosmetic, no runtime impact.
- **G-3** (grid fallback leading space) — only affects post-transposition reconstruction; original source always preserved.
- `%{...}` interpolation — out of scope (render-time concern).
- `getChordShape` instrument-selector filtering for `{define-guitar}` vs `{define-ukulele}` — currently all define nodes are checked regardless of selector. Noted as future refinement.

---

## Part 3 — Release readiness verdict

### API version: `0.2.0` (not `1.0.0`)

The library should remain `0.x` because:

1. Several new API surfaces (`resolveChorus`, `ChordDef`, `applyTransposeDirectives`, `toNashville`/`fromNashville` as fully-implemented functions) have no stabilization history. A consumer could reasonably discover edge cases that require signature changes.
2. `guessKey` had a behavioral breaking change in this release cycle (return value for minor keys changed from root-only string to qualified string like `"Am"`). This kind of undocumented breaking change would be inappropriate in a 1.0 package.
3. Tier 2 helpers (Nashville, chord shapes, key detection) are auxiliary and likely to evolve.

**Recommended version: `0.2.0`**. Reserve `1.0.0` for after GraceNote integration exercises have validated the real-world API surface.

### Release-blocking (must fix before publish)

- [x] **Lint errors** (L-1, L-2) — CI fails; npm publish would ship broken dist if CI is bypassed.

### Should fix before publish (done in this pass)

- [x] Version bump to 0.2.0
- [x] CHANGELOG updated
- [x] README Nashville stub language removed
- [x] parseFreeText key detection consistency

### Non-blocking (can follow in 0.2.x)

- Coverage trending down (still above threshold; no test gaps on Tier 1 core paths)
- `{chorus}` category label in KNOWN_DIRECTIVES
- Grid fallback leading-space difference

### Verdict: **Ready for external dependency** at `0.2.0`

The Tier 1 format core (parse/serialize/transpose/render/tokenize) is correct, complete, and stable. All GraceNote-critical behaviors verified. The public `exports` field, packaging, and never-throw guarantees are solid. The library is suitable for GraceNote to depend on, with the understanding that Tier 2 helpers (`guessKey`, `toNashville`, `getChordShape`) are auxiliary and may evolve in 0.x patches.
