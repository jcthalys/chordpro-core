# ChordPro Format: Implemented Subset

This document describes the ChordPro File Format as implemented by `chordpro-core`,
written from the public ChordPro specification (chordpro.org, ChordPro 6).
This is an independent implementation.

---

## Song structure

A ChordPro song is a sequence of lines. Each line is exactly one of:

| Kind | Detected by | Notes |
|------|-------------|-------|
| Blank | Empty or whitespace-only | Stanza separator |
| Comment | Starts with `#` | Preserved; not rendered |
| Directive | `{name}` or `{name: arg}` | See §Directives |
| Lyric | Anything else | May contain inline chords |

---

## Directives

### Syntax

```
{name}
{name: argument}
{name: key="value" key2="value2"}
{name positional label}
{name-selector: argument}
{name-selector!: argument}     ← negated selector
```

- Name/argument separated by `:` and/or whitespace.
- Attribute values accept `"double"` or `'single'` quotes.
- `{start_of_verse Verse 1}` is equivalent to `{start_of_verse label="Verse 1"}`.
- Conditional selectors (`-guitar`, `-tenor`, etc.) target specific output formatters; trailing `!` negates.
- End directives must NOT carry a selector.
- `x_`-prefixed custom directives are always preserved without warnings.

### Alias normalization

Short aliases normalize to their canonical long form in the parsed model,
but the original spelling is preserved for round-trip serialization.

| Short | Canonical |
|-------|-----------|
| `t` | `title` |
| `st` | `subtitle` |
| `c` | `comment` |
| `ci` | `comment_italic` |
| `cb` | `comment_box` |
| `soc` | `start_of_chorus` |
| `eoc` | `end_of_chorus` |
| `sov` | `start_of_verse` |
| `eov` | `end_of_verse` |
| `sob` | `start_of_bridge` |
| `eob` | `end_of_bridge` |
| `sot` | `start_of_tab` |
| `eot` | `end_of_tab` |
| `sog` | `start_of_grid` |
| `eog` | `end_of_grid` |
| `ns` | `new_song` |
| `np` | `new_page` |
| `npp` | `new_physical_page` |
| `colb` | `column_break` |
| `col` | `columns` |
| `g` | `grid` |
| `ng` | `no_grid` |

### Metadata directives (Tier 1 — behavior: extracted to `song.metadata`)

`title` `sorttitle` `subtitle` `artist` `sortartist` `composer` `lyricist`
`copyright` `album` `year` `key` `time` `tempo` `duration` `capo` `meta` `tag`

Special forms:
- `{meta: key value}` — sets metadata key `key` to `value`.
- `{tag: value}` — multi-valued; appended with `\n`.

### Formatting directives (behavior: typed nodes)

`comment` / `ci` / `cb` — inline comment boxes; rendered as text or distinct markup.  
`highlight` — highlight the following section.  
`image` — image reference (HTML-attribute args: `src`, `scale`, etc.).

### Environment pairs (behavior: paired `SectionNode`)

| Open | Close | Kind |
|------|-------|------|
| `start_of_chorus` (`soc`) | `end_of_chorus` (`eoc`) | `chorus` |
| `start_of_verse` (`sov`) | `end_of_verse` (`eov`) | `verse` |
| `start_of_bridge` (`sob`) | `end_of_bridge` (`eob`) | `bridge` |
| `start_of_prechorus` | `end_of_prechorus` | `prechorus` |
| `start_of_tab` (`sot`) | `end_of_tab` (`eot`) | `tab` |
| `start_of_grid` (`sog`) | `end_of_grid` (`eog`) | `grid` |

Standalone `{chorus}` → `ChorusReference` node (the app decides whether to expand or label it).

### Delegated environments (preserve-only)

Content is stored verbatim as `rawContent` without parsing:

`start_of_abc` / `end_of_abc`, `start_of_ly` / `end_of_ly`,
`start_of_svg` / `end_of_svg`, `start_of_textblock` / `end_of_textblock`

### Chord definitions

```
{define: NAME base-fret N frets f f f f f f fingers f f f f f f}
{chord: NAME base-fret N frets f f f f f f}
```

Parsed into `{ name, baseFret, frets[], fingers? }`. Missing fields tolerated.

### Transposition

`{transpose: N}` — affects following lines (model-level; `transpose()` applies it programmatically).

### Output/layout/legacy (preserve-only)

`new_page` `new_physical_page` `column_break` `columns` `grid` `no_grid`
`titles` `diagrams` `pagetype` and all legacy font/size/colour directives
(`textfont`, `chordsize`, `titlecolour`, `chordfont`, etc.) are held in the model
as generic `DirectiveLine` nodes and round-trip unchanged.

---

## Lyric lines

Chords are placed inside `[` `]` immediately before the syllable they sit above:

```
Swing [D]low, sweet [G]chari[D]ot
```

- A line may start with a chord, end with a chord (empty trailing lyric), or have a chord mid-word.
- `[*text]` — leading `*` means "print as annotation in chord position, never parse as a chord".

A lyric line is modeled as an ordered list of `Segment`:
```ts
{ chord?: Chord; annotation?: string; lyric: string }
```

Inside `start_of_tab` / `end_of_tab`, `[...]` is literal text — not parsed as chords.

---

## Chord grammar

### Strict mode (default)

Root: `A`–`G` (plus German `H`), with `#`/`b` accidentals. Alternate spellings:
`Bes` (B♭), `Es` (E♭), `As` (A♭), `Cis` (C#), `Dis` (D#), `Fis` (F#), `Gis` (G#), `Ges` (G♭), `Hes` (B♭).

Qualifiers: `m` / `mi` / `min` / `-` (minor); `aug` / `+`; `dim` / `°`.

Extensions: only those in the built-in table (see `src/chords/extensions.ts`). Examples:
`7`, `maj7`, `sus2`, `sus4`, `add9`, `dim7`, `m7b5`, `9`, `13`, `^7`, …

Slash chords: `C/B`, `Fmaj7/A` — bass note after `/`.

### Relaxed mode

Any trailing text after a recognized root and optional qualifier is accepted as an extension.
Used by `parseFreeText` and chord-line detection.

### Chord decomposition

```ts
interface Chord {
  name: string;      // original as written
  root?: string;     // "C", "F#", "Bb", …
  qualifier?: string;// "m", "dim", "aug", …
  extension?: string;// "7", "maj7", "sus4", …
  bass?: string;     // "B" in "C/B"
  parsed: boolean;
}
```

`parsed: false` means the chord name was kept but not decomposed (e.g. in strict mode for unknown chords). Never throws.

---

## Transposition

`transpose(song, semitones, options?)` and `transposeChord(chord, semitones, options?)`.

- Only operates on chords with `parsed: true`.
- Annotations pass through unchanged.
- Options: `preferSharps` / `preferFlats` (default: infer from existing root).
- `+n` then `−n` is identity on chord names.
- Tab blocks and delegated sections are not transposed.

---

## `{meta: repeat N}` convention (Tier 2)

`parseFreeText` emits `{meta: repeat N}` as the first directive inside a section
when a repeat count is found on the section heading (e.g. `[Refrão] (x2)`).

`{meta: repeat N}` is spec-legal (meta directives are arbitrary key-value pairs),
round-trips losslessly through `parse` / `serialize`, and gives consuming apps a
structured hook via `song.metadata.get('repeat')` when walking the section tree,
or by reading the `{meta:}` directive node directly.

This is a **Tier 2 convention** — it is emitted only by `parseFreeText` and is
not interpreted by any Tier 1 function.

---

## Guiding policy

> **Recognize and round-trip the entire format; implement semantics only for the
> well-defined subset; never silently drop anything.**

- `serialize(parse(x))` reproduces all directives (including the preserve-only tail),
  original chord spellings, comments, and metadata in document order.
- Whitespace normalization between a directive name and its argument is allowed.
