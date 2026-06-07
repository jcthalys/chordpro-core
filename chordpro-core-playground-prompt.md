# Follow-up build prompt: `chordpro-core` interactive playground

> **When to run this:** after Tier 1 of `chordpro-core` is complete (parse,
> serialize, parseChord, transpose, renderText/renderHtml all working and
> tested — the SPEC.md §15 checkpoint). Tier 2 panels (free-text, tokenizer)
> can be added as those features land. Do not build this against an unstable
> API.

## Goal

Build a single-page **interactive playground** for `chordpro-core`, deployable
to **GitHub Pages**, that lets anyone try every public feature of the library
live in the browser. It serves three purposes: interactive documentation, a
manual test surface for the spec's features, and a portfolio showpiece.

## Hard constraints (protect the library's purity)

- The playground is a **separate consumer** of the library. It lives in its own
  folder (`playground/`), NOT in `src/`. The library stays UI-free, DOM-free,
  framework-free.
- The playground **imports the built library** through its public API exactly
  as any external user would (`import { parse, transpose, tokenize, ... } from
  'chordpro-core'` — resolved to the built ESM output). It must NOT reach into
  library internals or relative `src/` paths. If something the playground needs
  isn't on the public API, that's a signal to reconsider the API, not to bypass
  it.
- **Plain HTML + CSS + vanilla JS/TS. No framework** (no React/Vue/etc). This
  keeps it light and proves the library works as a plain ESM import with zero
  framework. A tiny build step (e.g. esbuild/vite) to bundle the page module is
  fine; no UI framework.
- Zero network calls. Everything runs client-side.

## Layout — one page, panelled

A single `index.html` with a clean, responsive layout:

1. **Header** — library name, one-line description, links to the GitHub repo,
   the README, and the npm package. A short "what is this" blurb.
2. **Input panel** (left/top) — a `<textarea>` where the user types or pastes
   ChordPro source. Preload it with a good sample song (the "Swing Low Sweet
   Chariot" example from the spec, with a chorus, a comment, and a few extended
   chords) so the page is alive on first load.
3. **Controls bar** — toggles/inputs that drive the output:
   - chord mode: strict / relaxed
   - transpose: −/+ semitone stepper (shows current offset)
   - accidental preference: sharps / flats
   - a "load example" dropdown with several preset songs (see below)
4. **Output panel** (right/bottom) — **tabbed**, one tab per capability:
   - **Rendered** — `renderHtml` output, actually displayed (chords over
     lyrics). This is the "what it looks like" view.
   - **Text** — `renderText` monospace output in a `<pre>`.
   - **AST** — `JSON.stringify(parse(...), null, 2)` in a `<pre>`, so users see
     the data model. (Serialize the `Map` metadata to a plain object for
     display.)
   - **Tokens** — the `tokenize()` output rendered as colour-coded text: map
     each token `type` to a colour *in the playground's own CSS* (the library
     provides no colours). This both demonstrates the tokenizer and visually
     documents the token types. Include a small legend.
   - **Round-trip** — show `serialize(parse(input))` next to the original, and a
     clear ✓/✗ indicator of whether meaningful content survived (so the
     preserve-everything guarantee is visible).
   - **Chord inspector** — a small box where the user types a single chord and
     sees `parseChord` output (root / qualifier / extension / bass / parsed),
     plus, if available, `getChordShape` data shown as a simple text/ASCII or
     minimal SVG fret grid drawn *by the playground*.
   - **(Tier 2, add when ready) Free-text** — a second textarea where the user
     pastes loose chord-sheet text and sees `parseFreeText` convert it to
     ChordPro + the detected metadata pills (title/artist/key/BPM).
5. **Warnings strip** — anywhere `parse`/`parseFreeText` returns warnings, show
   them (line, code, message) so the never-throw/recover behaviour is visible.
6. **Footer** — version, MIT license note, "built from the public ChordPro
   specification" line.

## Behaviour

- Live update: re-run on input change, debounced (~200 ms). All output tabs
  reflect the current input + controls.
- The transpose stepper applies `transpose` to the parsed song before
  rendering; the AST/text/rendered tabs all reflect it.
- Nothing throws to the console on bad input — malformed input shows warnings
  and partial output, demonstrating graceful recovery. Include a deliberately
  broken example in the dropdown (unclosed directive, unclosed chord bracket) to
  showcase this.

## Preset examples (in the dropdown)

Include several `.cho` strings covering the spec's range:
- Simple song (the spec example).
- Extended chords (`Cadd9`, `Am7b5`, `Fmaj7/A`, `F#dim7`, …).
- Full metadata block (title, artist, key, capo, tempo, copyright, ccli).
- Sections (verse / chorus / bridge / tab block / grid).
- Annotations (`[*Coda]`, `[*Rit.]`).
- A "messy" free-text sample for the free-text tab (chords-above-lyrics, a
  `Tom:`/`Key:` line, Portuguese section headings).
- A deliberately broken sample (to show warnings + recovery).

## Deployment

- Add a **GitHub Actions workflow** that builds the playground and publishes it
  to **GitHub Pages** on push to the default branch. Use the standard
  `actions/deploy-pages` flow.
- The playground build must consume the library's built output (build the
  library first in the workflow, then the playground).
- Document in the README: a link to the live playground, and a "run locally"
  snippet (`npm run playground` or similar).

## Tests / quality

- The playground itself is manually testable by design, but add a minimal
  smoke test that the page module imports the library and that the core
  functions are callable (guards against the playground drifting from the public
  API).
- Keep the page accessible: semantic HTML, labelled controls, sufficient
  contrast, keyboard-usable tabs.

## Documentation tie-in

- Link the playground prominently from `README.md` ("Try it live").
- The playground's panels effectively document the API; reference it from the
  README as the interactive companion to `FORMAT.md`.

## What NOT to do

- Do not put any playground code in `src/`.
- Do not add a UI framework.
- Do not access library internals — public API only.
- Do not introduce runtime dependencies into the library to serve the
  playground.
