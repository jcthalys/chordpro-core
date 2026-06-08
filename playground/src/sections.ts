/**
 * All documentation sections.
 * Each section has: id, group, title, and a build(container) function.
 * Build functions use the public chordpro-core API only — no src/ access.
 */

import {
  parse, serialize, parseChord, transpose,
  tokenize, renderHtml, renderText, parseFreeText,
  guessKey, getChordShape, toNashville, fromNashville,
  applyTransposeDirectives, resolveChorus, collectChorusCandidates,
  soundingKey,
  KNOWN_DIRECTIVES, ALL_EXTENSIONS,
  type Song, type ParseOptions, type TransposeOptions, type ChordDef,
} from 'chordpro-core';

import { renderChordDiagram } from './chordDiagram.js';
import { EXAMPLES, FREE_TEXT_EXAMPLE, FREE_TEXT_EXAMPLES } from './examples.js';
import {
  esc, debounce, songToJson, warningsHtml, metaTableHtml,
  docCard, renderedPreview, renderTokens, TOKEN_LEGEND,
} from './lib.js';

export interface NavSection {
  id: string;
  group: string;
  title: string;
}

export interface Section extends NavSection {
  build(container: HTMLElement): void;
}

// ─── Helper: rendered output ──────────────────────────────────────────────────

function soundingKeyBar(song: Song): string {
  const key = song.metadata.get('key');
  const capo = song.metadata.get('capo');
  if (!key || !capo || capo === '0') return '';
  const sk = soundingKey(song);
  if (!sk || sk === key) return '';
  return `<div class="sounding-key-bar">Written key: <strong>${esc(key)}</strong> · Capo: <strong>${esc(capo)}</strong> · Sounds in: <strong>${esc(sk)}</strong></div>`;
}

function renderOutput(src: string, output: HTMLElement, opts: ParseOptions = {}) {
  const song = parse(src, opts);
  output.innerHTML = soundingKeyBar(song) + renderedPreview(renderHtml(song, { includeHeader: true }));
}

// ─── Section definitions ──────────────────────────────────────────────────────

export const SECTIONS: Section[] = [

  // ── Getting started ──────────────────────────────────────────────────────────

  {
    id: 'getting-started', group: 'Getting started', title: 'Quick start',
    build(container) {
      const { el } = docCard({
        prose: `
<p><strong>chordpro-core</strong> is a TypeScript library with zero runtime dependencies that parses, models, and transforms <a href="https://www.chordpro.org" target="_blank" rel="noopener">ChordPro&nbsp;6</a> files — the standard format for chord sheets in contemporary worship, folk, and pop music.</p>
<pre class="prose-code">npm install chordpro-core</pre>
<p>The three core operations are <code>parse()</code>, <code>transpose()</code>, and <code>renderHtml()</code>&nbsp;/&nbsp;<code>renderText()</code>. <code>parse()</code> turns source text into a structured <code>Song</code> object containing a metadata <code>Map</code>, an ordered array of <code>Line</code> nodes, and any non-fatal warnings. <code>transpose()</code> returns a new immutable song with every chord root shifted. The renderers produce strings — never DOM nodes.</p>
<p>Edit the example below and watch the output update live.</p>`,
        example: `{title: Swing Low, Sweet Chariot}
{artist: Traditional Spiritual}
{key: D}
{tempo: 72}

{start_of_verse label="Verse 1"}
[D]Swing [D7]low, sweet [G]chari[D]ot
[D]Comin' for to carry [A]me [A7]home
{end_of_verse}

{start_of_chorus}
[D]I [G]looked over [D]Jordan, and [G]what did I [D]see
A [D]band of [G]angels [D]comin' after [A]me
{end_of_chorus}

{chorus}`,
        outputLabel: 'Rendered',
        onUpdate(src, output) { renderOutput(src, output); },
      });
      mount(container, 'getting-started', 'Quick start', el);
    },
  },

  // ── The format ───────────────────────────────────────────────────────────────

  {
    id: 'lines', group: 'The format', title: 'Lines & comments',
    build(container) {
      const { el } = docCard({
        prose: `
<p>A ChordPro file is a sequence of <strong>four line types</strong>, identified by their first non-whitespace character:</p>
<ul>
  <li><strong>Blank line</strong> — separates stanzas; preserved in the model.</li>
  <li><strong>Comment line</strong> — starts with <code>#</code>; kept in the model but not rendered.</li>
  <li><strong>Directive line</strong> — wrapped in <code>{…}</code>; controls metadata, sections, and formatting.</li>
  <li><strong>Lyric line</strong> — everything else; may contain inline chords in <code>[…]</code>.</li>
</ul>
<p>Nothing is ever dropped. Every line — including blank lines and comments — is preserved in <code>song.lines</code> and round-trips perfectly through <code>serialize(parse(x))</code>. The AST tab shows the type field on each node.</p>`,
        example: `# This is a comment — preserved but not rendered

{title: Line Types Demo}

Lyric line with no chords here.

[G]Lyric line with [C]inline [D]chords.

# Another comment between verses`,
        outputLabel: 'AST (line types)',
        onUpdate(src, output) {
          const song = parse(src);
          const summary = song.lines.map((l, i) =>
            `<div class="line-row"><span class="line-num">${i + 1}</span><span class="line-type type-${l.type}">${l.type}</span><span class="line-preview">${esc(l.type === 'lyric' ? l.segments.map(s => (s.chord ? `[${s.chord.name}]` : '') + s.lyric).join('') : l.type === 'comment' ? l.text : l.type === 'directive' ? l.source : '')}</span></div>`
          ).join('');
          output.innerHTML = `<div class="line-list">${summary || '<em class="dim">Empty file</em>'}</div>`;
        },
      });
      mount(container, 'lines', 'Lines & comments', el);
    },
  },

  {
    id: 'directives', group: 'The format', title: 'Directives',
    build(container) {
      const { el } = docCard({
        prose: `
<p>Directives are wrapped in <code>{…}</code> and control everything from metadata to section structure. They take several forms:</p>
<pre class="prose-code">{name}                      — no argument
{name: value}               — simple value
{name: key="v1" key2="v2"}  — HTML-style attributes
{name label}                — positional label (equivalent to label="label")</pre>
<p>Short alias names (<code>t</code>, <code>soc</code>, <code>eov</code>…) are normalized to canonical long names in the model but preserved in their original spelling for round-tripping. Conditional selector suffixes like <code>{comment-guitar: …}</code> target specific formatters; trailing <code>!</code> negates. Custom <code>x_</code>-prefixed directives are always preserved without warnings.</p>`,
        example: `{title: Directive Forms}
{t: Short alias for title}
{artist: Test Artist}
{comment: A simple formatted comment}
{image: src="photo.jpg" scale="50%"}
{start_of_verse Verse 1}
[G]Content here
{end_of_verse}
{comment-guitar: Play with pick}
{x_custom_field: any value}`,
        outputLabel: 'Directives in model',
        onUpdate(src, output) {
          const song = parse(src);
          const directives = song.lines.filter(l => l.type === 'directive');
          const rows = directives.map(d => {
            if (d.type !== 'directive') return '';
            const attrs = Object.entries(d.attributes).filter(([k]) => k !== 'label').map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
            return `<tr><td><code>{${esc(d.originalName)}}</code></td><td><code>${esc(d.name)}</code></td><td>${esc(d.argument ?? '')}</td><td>${attrs ? `<code>${attrs}</code>` : ''}</td><td>${d.selector ? `<code>${esc(d.selector)}${d.negated ? '!' : ''}</code>` : ''}</td></tr>`;
          }).join('');
          output.innerHTML = directives.length === 0
            ? '<p class="dim">No directives found.</p>'
            : `<table class="data-table"><thead><tr><th>Original</th><th>Canonical name</th><th>Argument</th><th>Attributes</th><th>Selector</th></tr></thead><tbody>${rows}</tbody></table>`;
        },
      });
      mount(container, 'directives', 'Directives', el);
    },
  },

  {
    id: 'metadata', group: 'The format', title: 'Metadata',
    build(container) {
      const { el } = docCard({
        prose: `
<p>Metadata directives populate <code>song.metadata</code>, a <code>Map&lt;string, string&gt;</code> that preserves insertion order. The core fields are: <code>title</code>, <code>subtitle</code>, <code>artist</code>, <code>composer</code>, <code>lyricist</code>, <code>key</code>, <code>time</code>, <code>tempo</code>, <code>capo</code>, <code>duration</code>, <code>copyright</code>, <code>album</code>, <code>year</code>, <code>sorttitle</code>, <code>sortartist</code>.</p>
<p>The special <code>{meta: key value}</code> form sets arbitrary metadata fields. <code>{tag: …}</code> is multi-valued; subsequent tags are appended with a newline separator. Short aliases (<code>t</code>&nbsp;=&nbsp;<code>title</code>, <code>st</code>&nbsp;=&nbsp;<code>subtitle</code>) are normalized.</p>
<p>Tier-2 convenience: <code>{ccli: …}</code> and <code>{ccli_number: …}</code> both map to the <code>ccli</code> metadata key.</p>`,
        example: `{title: Complete Metadata Example}
{subtitle: Testing all fields}
{artist: The Artist}
{composer: J.S. Bach}
{key: D}
{time: 4/4}
{tempo: 72}
{capo: 2}
{copyright: 2024 Example}
{album: Demo Album}
{year: 2024}
{ccli: 99999}
{meta: genre Folk}
{tag: example}
{tag: test}`,
        outputLabel: 'song.metadata',
        onUpdate(src, output) {
          output.innerHTML = metaTableHtml(parse(src));
        },
      });
      mount(container, 'metadata', 'Metadata', el);
    },
  },

  {
    id: 'sections', group: 'The format', title: 'Verse, chorus, bridge',
    build(container) {
      const { el } = docCard({
        prose: `
<p>Section environments wrap lines in paired directives — <code>{start_of_*}</code> / <code>{end_of_*}</code> — and appear in the model as a <code>SectionNode</code> with a <code>kind</code> and optional <code>label</code>. The defined kinds are: <code>chorus</code>, <code>verse</code>, <code>bridge</code>, <code>prechorus</code>, <code>tab</code>, <code>grid</code>, and the delegated environments <code>abc</code>, <code>ly</code>, <code>svg</code>, <code>textblock</code>.</p>
<p>The standalone <code>{chorus}</code> directive (no <code>start_of_</code>) becomes a <code>ChorusReference</code> — a pointer to a previously-defined chorus. Whether to expand it or just label it is the application's decision.</p>
<p>Any unrecognised <code>start_of_X</code> / <code>end_of_X</code> pair is parsed as a <code>kind: "custom"</code> section rather than triggering an unknown-directive warning.</p>`,
        example: `{start_of_verse label="Verse 1"}
[G]Amazing [C]grace, how [G]sweet the [D]sound
[G]That saved a [Em]wretch like [D]me
{end_of_verse}

{start_of_prechorus}
[Em]And I know [A7]this much is [D]true
{end_of_prechorus}

{start_of_chorus}
[G]How great [C]is our [G]God
[D]Sing with [Em]me how [C]great is [G]our God
{end_of_chorus}

{start_of_bridge}
[Em]Name above [D]all names
{end_of_bridge}

{chorus}`,
        outputLabel: 'Rendered',
        onUpdate(src, output) { renderOutput(src, output); },
      });
      mount(container, 'sections', 'Verse, chorus, bridge', el);
    },
  },

  {
    id: 'chorus-ref', group: 'The format', title: 'Chorus references',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'chorus-ref'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Chorus references</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';

      card.innerHTML = `
<div class="prose-block">
<p>The standalone <code>{chorus}</code> directive (no <code>start_of_</code>) is a <em>reference</em> to a previously-defined chorus — it means "repeat the chorus here". The model stores it as a <code>ChorusReference</code> node with an optional <code>label</code> field.</p>
<p><code>resolveChorus(song, ref)</code> resolves the reference by returning the <strong>last</strong> matching <code>SectionNode</code> that precedes the reference in document order (matching by label when one is given). <code>collectChorusCandidates</code> returns all matches.</p>
<pre class="prose-code">resolveChorus(song: Song, ref: ChorusReference): SectionNode | null
collectChorusCandidates(song: Song, ref: ChorusReference): SectionNode[]</pre>
</div>
<div class="example-area">
  <div class="example-pane input-pane">
    <div class="pane-label">Editor</div>
    <textarea class="code-editor" id="cref-editor" spellcheck="false">{title: My Song}
{key: G}

{start_of_chorus label="Hook"}
[G]How great [C]is our [G]God
[D]Sing with [Em]me how [C]great is [G]our God
{end_of_chorus}

{start_of_verse}
[G]Amazing [C]grace, how [G]sweet the sound
{end_of_verse}

{chorus: Hook}

{start_of_verse}
[G]When we've been there [C]ten thousand years
{end_of_verse}

{chorus: Hook}</textarea>
  </div>
  <div class="example-pane output-pane">
    <div class="pane-label">Resolved chorus content</div>
    <div class="example-output" id="cref-output"></div>
  </div>
</div>`;

      sec.appendChild(card);
      container.appendChild(sec);

      const editor = card.querySelector<HTMLTextAreaElement>('#cref-editor')!;
      const output = card.querySelector<HTMLElement>('#cref-output')!;

      function update() {
        const song = parse(editor.value);
        const refs = song.lines.filter(l => l.type === 'chorus_reference');
        if (refs.length === 0) {
          output.innerHTML = '<p class="dim">No <code>{chorus}</code> references found in the song.</p>';
          return;
        }
        const parts: string[] = [];
        refs.forEach((ref, i) => {
          if (ref.type !== 'chorus_reference') return;
          const resolved = resolveChorus(song, ref);
          const all = collectChorusCandidates(song, ref);
          const labelStr = ref.label ? ` label="${esc(ref.label)}"` : '';
          parts.push(`<div class="cref-block">
<div class="cref-header">Reference #${i + 1}: <code>{chorus${labelStr}}</code> — ${all.length} candidate(s), resolves to <strong>${resolved ? `"${esc(resolved.label ?? 'unlabeled')}"` : 'null'}</strong></div>
${resolved ? `<div class="cref-content">${renderedPreview(renderHtml({ ...song, lines: resolved.lines }, { includeHeader: false }))}</div>` : '<p class="dim">No matching chorus found before this reference.</p>'}
</div>`);
        });
        output.innerHTML = parts.join('');
      }

      const deb = debounce(update, 250);
      editor.addEventListener('input', deb);
      update();
    },
  },

  {
    id: 'inline-chords', group: 'The format', title: 'Inline chords',
    build(container) {
      const { el } = docCard({
        prose: `
<p>Chords are placed in square brackets immediately before the syllable they are played on:</p>
<pre class="prose-code">Swing [D]low, sweet [G]chari[D]ot</pre>
<p>The parser breaks each lyric line into an ordered array of <code>Segment</code> objects, each carrying an optional <code>chord</code> and the lyric text that follows it. A segment may have a chord but no lyric (trailing chord at line end), a lyric but no chord (plain text run), or both.</p>
<p>Chords inside a <code>start_of_tab</code> block are treated as literal text — they are never parsed or transposed.</p>`,
        example: `[D]Swing [D7]low, sweet [G]chari[D]ot
[D]Comin' for to carry [A]me [A7]home
[D]Swing [D7]low, sweet [G]chari[D]ot
Comin' for to [A7]carry me [D]`,
        outputLabel: 'Segments',
        onUpdate(src, output) {
          const song = parse(src);
          const lines = song.lines.filter(l => l.type === 'lyric');
          if (lines.length === 0) { output.innerHTML = '<p class="dim">No lyric lines found.</p>'; return; }
          const html = lines.map(l => {
            if (l.type !== 'lyric') return '';
            const segs = l.segments.map(s => {
              const c = s.chord ? `<span class="seg-chord">[${esc(s.chord.name)}]</span>` : s.annotation ? `<span class="seg-ann">[*${esc(s.annotation)}]</span>` : '';
              return `<span class="seg">${c}<span class="seg-lyric">${esc(s.lyric) || '∅'}</span></span>`;
            }).join('');
            return `<div class="seg-line">${segs}</div>`;
          }).join('');
          output.innerHTML = `<div class="seg-display">${html}</div>` + renderedPreview(renderHtml(song, { includeHeader: false }));
        },
      });
      mount(container, 'inline-chords', 'Inline chords', el);
    },
  },

  {
    id: 'annotations', group: 'The format', title: 'Annotations [*text]',
    build(container) {
      const { el } = docCard({
        prose: `
<p>A bracket that starts with <code>*</code> is an annotation — a text label printed in the chord position, never parsed as a chord and never transposed:</p>
<pre class="prose-code">[*Coda]  [*D.C. al Fine]  [*Intro]  [*Rit.]</pre>
<p>In the model, annotations live in <code>segment.annotation</code> rather than <code>segment.chord</code>. The renderer emits them with a distinct <code>.cp-annotation</code> class. Try transposing: the annotations stay while the chords move.</p>`,
        example: `[*Intro][G]Hello [C]world
[G]Amazing [C]grace [G] [*Fine]
[*D.C.][D]Back to the [G]start [*Rit.]
[G]Final [Em]line [C] [D] [G]`,
        outputLabel: 'Rendered',
        onUpdate(src, output) { renderOutput(src, output); },
      });
      mount(container, 'annotations', 'Annotations [*text]', el);
    },
  },

  {
    id: 'tab-grid', group: 'The format', title: 'Tab & grid blocks',
    build(container) {
      const { el } = docCard({
        prose: `
<p><strong>Tab blocks</strong> (<code>{start_of_tab}</code>…<code>{end_of_tab}</code>) preserve their inner lines verbatim as <code>TabLine</code> nodes — no chord parsing, no transposition.</p>
<p><strong>Grid blocks</strong> (<code>{start_of_grid}</code>…<code>{end_of_grid}</code>) parse each row into cells separated by <code>|</code>, with chords parsed in relaxed mode. Grids <em>do</em> transpose with the song. The original source line is stored for lossless round-tripping.</p>
<p><strong>Delegated environments</strong> (<code>abc</code>, <code>ly</code>, <code>svg</code>, <code>textblock</code>) preserve their inner content as raw text — the library does not render or interpret them, only keeps them faithfully.</p>`,
        example: `{start_of_tab}
e|--3--2--0--------|
B|--3--3--1--0-----|
G|--0--2--0--0-----|
D|--0--0--2--2-----|
A|--2---------3----|
E|--3--------------|
{end_of_tab}

{start_of_grid}
G | Cadd9 | Em | D
G | Cadd9 | D  | G
{end_of_grid}

{start_of_abc}
X:1
T:A Simple Tune
K:G
G2AB c2BA | G4 G4 |
{end_of_abc}`,
        outputLabel: 'Rendered',
        onUpdate(src, output) { renderOutput(src, output); },
      });
      mount(container, 'tab-grid', 'Tab & grid blocks', el);
    },
  },

  {
    id: 'chord-def', group: 'The format', title: 'Chord definitions ({define})',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'chord-def'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Chord definitions ({define})</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
<div class="prose-block">
<p><code>{define}</code> and <code>{chord}</code> directives declare a chord fingering. The parser emits a structured <code>ChordDef</code> model node — not a generic directive — so consuming code can read the fields directly:</p>
<pre class="prose-code">interface ChordDef {
  type: 'chord_def';
  name: string;           // e.g. "Am"
  originalName: 'define' | 'chord';
  baseFret?: number;      // 1-indexed fret position
  frets?: number[];       // per-string frets (-1 = muted, 0 = open)
  fingers?: number[];     // optional finger assignments
  keys?: number[];        // keyboard: intervals from root
  copy?: string;          // inherit from another chord name
  display?: string;       // displayed name (may differ)
  source: string;         // original text for round-trip
}</pre>
<p><code>getChordShape(name, instrument, song?)</code> reads <code>ChordDef</code> nodes directly from the song when a third argument is passed — song-defined chords take priority over the built-in seed table.</p>
</div>
<div class="example-area">
  <div class="example-pane input-pane">
    <div class="pane-label">Editor</div>
    <textarea class="code-editor" id="cdef-editor" spellcheck="false">{define: Xmaj7 base-fret 1 frets x 3 2 0 0 0 fingers 0 3 2 0 0 0}
{define: Ysus4 base-fret 2 frets x 1 3 3 1 1 fingers 0 1 3 4 1 1}

{title: Song with custom chords}

[Xmaj7]Swing [Ysus4]low, sweet [C]chariot</textarea>
  </div>
  <div class="example-pane output-pane">
    <div class="pane-label">Parsed ChordDef nodes + diagram</div>
    <div class="example-output" id="cdef-output"></div>
  </div>
</div>`;

      sec.appendChild(card);
      container.appendChild(sec);

      const editor = card.querySelector<HTMLTextAreaElement>('#cdef-editor')!;
      const output = card.querySelector<HTMLElement>('#cdef-output')!;

      function update() {
        const song = parse(editor.value);
        const defs = song.lines.filter((l): l is ChordDef => l.type === 'chord_def');
        if (defs.length === 0) {
          output.innerHTML = '<p class="dim">No <code>{define}</code> or <code>{chord}</code> directives found.</p>';
          return;
        }
        const parts: string[] = [];
        for (const def of defs) {
          const shape = getChordShape(def.name, 'guitar', song);
          const diag = shape ? `<div class="diag-wrap">${renderChordDiagram(def.name, shape)}</div>` : '';
          const data: Partial<ChordDef> & { type?: string } = { ...def };
          delete (data as Record<string,unknown>)['source'];
          parts.push(`<div class="cdef-block">
<div class="cdef-name">{${def.originalName}: ${esc(def.name)}}</div>
<div class="cdef-row">
  ${diag}
  <pre class="shape-data cdef-json">${esc(JSON.stringify(data, null, 2))}</pre>
</div>
</div>`);
        }
        output.innerHTML = parts.join('');
      }

      const deb = debounce(update, 250);
      editor.addEventListener('input', deb);
      update();
    },
  },

  // ── Chords ───────────────────────────────────────────────────────────────────

  {
    id: 'chord-anatomy', group: 'Chords', title: 'Chord anatomy',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'chord-anatomy'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Chord anatomy</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';

      card.innerHTML = `
<div class="prose-block">
<p><code>parseChord(name, options?)</code> decomposes a chord name into four components:</p>
<ul>
  <li><strong>root</strong> — the note: A–G (plus German H), with <code>#</code>/<code>b</code> accidentals, or solfège spellings like <code>Bes</code>, <code>Es</code>, <code>Cis</code>.</li>
  <li><strong>qualifier</strong> — the quality: <code>m</code>/<code>mi</code>/<code>min</code>/<code>-</code> (minor), <code>aug</code>, <code>dim</code>.</li>
  <li><strong>extension</strong> — the colour: <code>7</code>, <code>maj7</code>, <code>sus4</code>, <code>add9</code>, <code>dim7</code>, …</li>
  <li><strong>bass</strong> — the slash-bass note: <code>A</code> in <code>Fmaj7/A</code>.</li>
</ul>
<p>The function never throws. On strict-mode failure it returns <code>parsed: false</code> and keeps the original name unchanged.</p>
</div>
<div class="chord-inspector-area">
  <div class="ci-input-row">
    <input type="text" id="ci-chord-input" class="chord-name-input" value="Am7b5" spellcheck="false" placeholder="e.g. Fmaj7/A" aria-label="Chord name" />
    <select id="ci-instrument" class="instrument-select" aria-label="Instrument for diagram">
      <option value="guitar">Guitar</option>
      <option value="ukulele">Ukulele</option>
    </select>
  </div>
  <div id="ci-result" class="ci-result"></div>
</div>`;

      sec.appendChild(card);
      container.appendChild(sec);

      const input = card.querySelector<HTMLInputElement>('#ci-chord-input')!;
      const instrSel = card.querySelector<HTMLSelectElement>('#ci-instrument')!;
      const result = card.querySelector<HTMLElement>('#ci-result')!;

      function updateCI() {
        const name = input.value.trim();
        if (!name) { result.innerHTML = '<p class="dim">Type a chord name above.</p>'; return; }
        const strict = parseChord(name, { mode: 'strict' });
        const relaxed = parseChord(name, { mode: 'relaxed' });
        const instr = instrSel.value as 'guitar' | 'ukulele';
        const shape = getChordShape(name, instr);
        const row = (l: string, v: string | undefined, cls = '') =>
          `<tr><td class="pl">${l}</td><td class="pv ${cls}">${v !== undefined ? esc(v) : '<em class="none">—</em>'}</td></tr>`;
        const tbl = (ch: ReturnType<typeof parseChord>, mode: string) =>
          `<table class="chord-prop-table"><caption>${mode}</caption>
          ${row('parsed', ch.parsed ? '✓ yes' : '✗ no', ch.parsed ? 'ok' : 'fail')}
          ${row('root', ch.root)}${row('qualifier', ch.qualifier)}${row('extension', ch.extension)}${row('bass', ch.bass)}</table>`;
        const diag = shape
          ? `<div class="diag-wrap">${renderChordDiagram(name, shape)}</div>`
          : `<p class="dim no-shape">No built-in shape for ${esc(name)} (${instr})</p>`;
        result.innerHTML = `<div class="ci-grid">${tbl(strict, 'Strict')}${tbl(relaxed, 'Relaxed')}<div>${diag}</div></div>`;
      }

      const debouncedCI = debounce(updateCI, 200);
      input.addEventListener('input', debouncedCI);
      instrSel.addEventListener('change', updateCI);
      updateCI();
    },
  },

  {
    id: 'strict-relaxed', group: 'Chords', title: 'Strict vs relaxed',
    build(container) {
      const { el } = docCard({
        prose: `
<p>The chord parser has two modes, selectable with <code>parseChord(name, { mode: 'strict' | 'relaxed' })</code> or the <code>chordMode</code> parse option.</p>
<p><strong>Strict</strong> (default): the extension must be in the built-in table. Unknown extensions return <code>parsed:&nbsp;false</code>. This is right for validating real chord sheets.</p>
<p><strong>Relaxed</strong>: any text after a recognised root and optional qualifier is accepted as an extension. Useful for pre-screening chord-sheet text where spelling may be imprecise. The <code>parseFreeText()</code> helper uses relaxed mode internally when detecting chord-only lines.</p>`,
        example: `Am7b5
Fmaj7/A
Bbmaj7
Esus2
G7sus4
Cadd9
Coda
Gm*
InvalidRoot`,
        outputLabel: 'Strict vs relaxed',
        onUpdate(src, output) {
          const chords = src.split('\n').map(l => l.trim()).filter(Boolean);
          const rows = chords.map(name => {
            const s = parseChord(name, { mode: 'strict' });
            const r = parseChord(name, { mode: 'relaxed' });
            const cell = (c: typeof s) => c.parsed
              ? `<td class="ok">${esc(c.root ?? '')} <span class="dim">${esc(c.qualifier ?? '')} ${esc(c.extension ?? '')} ${c.bass ? '/' + esc(c.bass) : ''}</span></td>`
              : `<td class="fail">✗ unparsed</td>`;
            return `<tr><td><code>${esc(name)}</code></td>${cell(s)}${cell(r)}</tr>`;
          }).join('');
          output.innerHTML = `<table class="data-table"><thead><tr><th>Chord</th><th>Strict</th><th>Relaxed</th></tr></thead><tbody>${rows}</tbody></table>`;
        },
      });
      mount(container, 'strict-relaxed', 'Strict vs relaxed', el);
    },
  },

  {
    id: 'chord-extensions', group: 'Chords', title: 'Extension reference',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'chord-extensions'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Extension reference</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';

      const prose = document.createElement('div');
      prose.className = 'prose-block';
      prose.innerHTML = `<p>The built-in strict-mode extension table contains <strong>${ALL_EXTENSIONS.length} entries</strong>. Each forms a valid chord on any root (e.g. <code>C7sus4</code>, <code>Am7b5</code>). Major extensions use <code>^</code> as an alias for <code>maj</code>.</p><p>Filter the table to find any extension:</p>`;
      card.appendChild(prose);

      const filterInput = document.createElement('input');
      filterInput.type = 'text';
      filterInput.className = 'ext-filter';
      filterInput.placeholder = 'Filter extensions…';
      filterInput.setAttribute('aria-label', 'Filter extensions');
      card.appendChild(filterInput);

      const grid = document.createElement('div');
      grid.className = 'ext-grid';
      card.appendChild(grid);

      function renderExts(filter: string) {
        const matches = ALL_EXTENSIONS.filter(e => !filter || e.toLowerCase().includes(filter.toLowerCase()));
        grid.innerHTML = matches.map(e => `<code class="ext-chip">C<span class="ext-part">${esc(e)}</span></code>`).join('');
        if (matches.length === 0) grid.innerHTML = '<span class="dim">No matches.</span>';
      }
      renderExts('');
      filterInput.addEventListener('input', () => renderExts(filterInput.value));

      sec.appendChild(card);
      container.appendChild(sec);
    },
  },

  // ── Transforms ───────────────────────────────────────────────────────────────

  {
    id: 'transpose', group: 'Transforms', title: 'Transpose',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'transpose'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Transpose</h2>';

      let offset = 0;
      let preferFlats = false;
      let preferSharps = false;

      const card = document.createElement('div');
      card.className = 'doc-card';

      const prose = document.createElement('div');
      prose.className = 'prose-block';
      prose.innerHTML = `
<p><code>transpose(song, semitones, options?)</code> returns a <strong>new, immutable</strong> Song with every parsed chord root shifted by the given number of semitones. The original is never mutated. <code>transposeChord(chord, semitones, options?)</code> works on a single chord.</p>
<p>Accidental preference: if neither <code>preferSharps</code> nor <code>preferFlats</code> is set, the library infers preference from each chord's original root (flat roots stay flat). Tab blocks, delegated environments (ABC/Lilypond/SVG), and annotation spans are never touched.</p>
<p>The key metadata field is also transposed and preserves its minor qualifier: <code>Am</code>&nbsp;+&nbsp;2&nbsp;→&nbsp;<code>Bm</code>, not <code>B</code>.</p>`;
      card.appendChild(prose);

      const area = document.createElement('div');
      area.className = 'example-area';
      card.appendChild(area);

      const inputPane = document.createElement('div');
      inputPane.className = 'example-pane input-pane';
      inputPane.innerHTML = '<div class="pane-label">Editor</div>';
      const editor = document.createElement('textarea');
      editor.className = 'code-editor';
      editor.spellcheck = false;
      editor.value = `{key: G}

{start_of_verse}
[G]Swing [D]low, sweet [C]chari[G]ot
[Em]Comin' for to [D]carry me [G]home
{end_of_verse}`;
      inputPane.appendChild(editor);
      area.appendChild(inputPane);

      // Controls
      const ctrl = document.createElement('div');
      ctrl.className = 'card-controls';
      ctrl.innerHTML = `
<div class="tp-controls">
  <div class="tp-group">
    <button class="tp-btn" id="tp-down" aria-label="Transpose down">−</button>
    <span class="tp-display" id="tp-display">0</span>
    <button class="tp-btn" id="tp-up" aria-label="Transpose up">+</button>
    <button class="tp-reset" id="tp-reset" aria-label="Reset">↺ reset</button>
  </div>
  <div class="tp-group">
    <label class="tp-radio"><input type="radio" name="tp-acc" value="auto" checked> Auto</label>
    <label class="tp-radio"><input type="radio" name="tp-acc" value="sharps"> Sharps ♯</label>
    <label class="tp-radio"><input type="radio" name="tp-acc" value="flats"> Flats ♭</label>
  </div>
</div>`;
      area.appendChild(ctrl);

      const outputPane = document.createElement('div');
      outputPane.className = 'example-pane output-pane';
      outputPane.innerHTML = '<div class="pane-label">Transposed output</div>';
      const output = document.createElement('div');
      output.className = 'example-output';
      outputPane.appendChild(output);
      area.appendChild(outputPane);

      function getOpts(): TransposeOptions {
        const checked = ctrl.querySelector<HTMLInputElement>('input[name="tp-acc"]:checked')?.value ?? 'auto';
        return checked === 'sharps' ? { preferSharps: true } : checked === 'flats' ? { preferFlats: true } : {};
      }

      function refreshDisplay() {
        ctrl.querySelector<HTMLElement>('#tp-display')!.textContent = (offset > 0 ? '+' : '') + offset;
      }

      function update() {
        const song = parse(editor.value);
        const transposed = offset !== 0 ? transpose(song, offset, getOpts()) : song;
        const keyBefore = song.metadata.get('key') ?? '—';
        const keyAfter = transposed.metadata.get('key') ?? '—';
        const keyLine = offset !== 0 ? `<div class="tp-key-badge">Key: <strong>${esc(keyBefore)}</strong> → <strong>${esc(keyAfter)}</strong></div>` : '';
        output.innerHTML = keyLine + renderedPreview(renderHtml(transposed, { includeHeader: false }));
      }

      const debouncedUpdate = debounce(update, 200);
      editor.addEventListener('input', debouncedUpdate);
      ctrl.querySelector('#tp-down')!.addEventListener('click', () => { offset--; refreshDisplay(); update(); });
      ctrl.querySelector('#tp-up')!.addEventListener('click', () => { offset++; refreshDisplay(); update(); });
      ctrl.querySelector('#tp-reset')!.addEventListener('click', () => { offset = 0; refreshDisplay(); update(); });
      ctrl.querySelectorAll('input[name="tp-acc"]').forEach(el => el.addEventListener('change', update));
      update();

      sec.appendChild(card);
      container.appendChild(sec);
    },
  },

  {
    id: 'in-song-transpose', group: 'Transforms', title: 'In-song {transpose}',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'in-song-transpose'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">In-song {transpose} directive</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
<div class="prose-block">
<p>A <code>{transpose: N}</code> directive placed <em>inside</em> a song shifts all chords that follow it by N semitones — without affecting chords before it. This creates a modulation effect. The renderers apply it automatically.</p>
<ul>
  <li><code>{transpose: 2}</code> — raise by 2 semitones from this point</li>
  <li><code>{transpose: 2s}</code> / <code>{transpose: 2f}</code> — force sharps or flats</li>
  <li><code>{transpose}</code> — cancel: reset to 0 semitones</li>
</ul>
<p>The directive node is preserved in the AST for round-trip fidelity. <code>applyTransposeDirectives(song)</code> is also exported so you can apply it explicitly before passing the song to your own renderer.</p>
</div>
<div class="example-area">
  <div class="example-pane input-pane">
    <div class="pane-label">Editor</div>
    <textarea class="code-editor" id="ist-editor" spellcheck="false">{title: Modulating Song}
{key: G}

{start_of_verse label="Verse — key of G"}
[G]Amazing [C]grace, how [G]sweet the [D]sound
[G]That saved a [Em]wretch like [D]me
{end_of_verse}

# Modulate up 2 semitones (G → A)
{transpose: 2}

{start_of_chorus label="Chorus — key of A"}
[G]How great [C]is our [G]God
[D]Sing with [Em]me how [C]great is [G]our God
{end_of_chorus}

# Cancel transposition
{transpose}

{start_of_verse label="Back to G"}
[G]When we've [C]been there [G]ten thousand [D]years
{end_of_verse}</textarea>
  </div>
  <div class="example-pane output-pane">
    <div class="pane-label">Rendered (transpose applied)</div>
    <div class="example-output" id="ist-output"></div>
  </div>
</div>`;

      sec.appendChild(card);
      container.appendChild(sec);

      const editor = card.querySelector<HTMLTextAreaElement>('#ist-editor')!;
      const output = card.querySelector<HTMLElement>('#ist-output')!;

      function update() {
        const song = parse(editor.value);
        output.innerHTML = renderedPreview(renderHtml(song, { includeHeader: false }));
      }

      const deb = debounce(update, 250);
      editor.addEventListener('input', deb);
      update();
    },
  },

  {
    id: 'nashville', group: 'Transforms', title: 'Nashville numbers',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'nashville'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Nashville numbers</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
<div class="prose-block">
<p>The Nashville Number System replaces note names with scale degrees relative to a key: <code>1</code>&nbsp;=&nbsp;root, <code>4</code>&nbsp;=&nbsp;fourth degree, <code>5</code>&nbsp;=&nbsp;fifth, and so on. Chromatic roots use a flat prefix: F in G&nbsp;→&nbsp;<code>b7</code>, Bb in G&nbsp;→&nbsp;<code>b3</code>. Qualifiers, extensions, and bass notes are preserved: <code>Am7</code> in C&nbsp;→&nbsp;<code>6m7</code>.</p>
<p><code>toNashville(song, key)</code> converts chord names to degrees. <code>fromNashville(song, key)</code> converts back. <code>fromNashville(toNashville(song, key), key)</code> is identity on all diatonic chord names.</p>
</div>
<div class="nash-controls">
  <label class="nash-key-label">Key:
    <input type="text" id="nash-key" class="chord-name-input nash-key-input" value="G" maxlength="4" aria-label="Key" />
  </label>
</div>
<div class="example-area">
  <div class="example-pane input-pane">
    <div class="pane-label">ChordPro source</div>
    <textarea class="code-editor" id="nash-editor" spellcheck="false">{title: Swing Low}
{key: G}

{start_of_verse}
[G]Swing [D]low, sweet [C]chari[G]ot
[Em]Comin' [D]for to [C]carry me [G]home
{end_of_verse}

{start_of_chorus}
[G]Carry [D]me [C]home, sweet [G]chariot
[Em]Comin' [D]for to [Am7]carry me [G]home
{end_of_chorus}</textarea>
  </div>
  <div class="nash-output-col">
    <div class="example-pane output-pane">
      <div class="pane-label">→ Nashville numbers</div>
      <div class="example-output" id="nash-to-out"></div>
    </div>
    <div class="example-pane output-pane">
      <div class="pane-label">← Back to named chords</div>
      <div class="example-output" id="nash-from-out"></div>
    </div>
  </div>
</div>`;

      sec.appendChild(card);
      container.appendChild(sec);

      const editor = card.querySelector<HTMLTextAreaElement>('#nash-editor')!;
      const keyInput = card.querySelector<HTMLInputElement>('#nash-key')!;
      const toOut = card.querySelector<HTMLElement>('#nash-to-out')!;
      const fromOut = card.querySelector<HTMLElement>('#nash-from-out')!;

      function update() {
        const key = keyInput.value.trim() || 'G';
        const song = parse(editor.value);
        const nashSong = toNashville(song, key);
        const backSong = fromNashville(nashSong, key);
        toOut.innerHTML = renderedPreview(renderHtml(nashSong, { includeHeader: false }));
        fromOut.innerHTML = renderedPreview(renderHtml(backSong, { includeHeader: false }));
      }

      const deb = debounce(update, 250);
      editor.addEventListener('input', deb);
      keyInput.addEventListener('input', deb);
      update();
    },
  },

  {
    id: 'key-detect', group: 'Transforms', title: 'Key detection',
    build(container) {
      const { el } = docCard({
        prose: `
<p><code>guessKey(songOrSource)</code> analyses chord-root frequencies across a song and returns the most common root as the detected key, together with a <code>confidence</code> score between 0 and 1.</p>
<p>A result is only returned when the most frequent root appears <strong>at least twice</strong> — one occurrence is not enough evidence. The function accepts either a source string or a pre-parsed <code>Song</code> object. It returns <code>null</code> when there are no chords or insufficient data.</p>
<p>Try removing the <code>{key:}</code> directive below — the detector works purely from the chord content.</p>`,
        example: `[G]Amazing [D]grace, how [G]sweet the [C]sound
[G]That saved [D]a wretch like [G]me
[G]I once was [D]lost, but [G]now am [C]found
[G]Was blind, but [D]now I [G]see`,
        outputLabel: 'Detected key',
        onUpdate(src, output) {
          const result = guessKey(src);
          if (!result) {
            output.innerHTML = '<p class="dim">Could not detect key — no chords or fewer than 2 occurrences of any root.</p>';
            return;
          }
          const pct = Math.round(result.confidence * 100);
          const bar = `<div class="conf-bar"><div class="conf-fill" style="width:${pct}%"></div></div>`;
          output.innerHTML = `
<div class="key-result">
  <div class="key-badge">${esc(result.key)}</div>
  <div class="key-detail">
    <strong>Key: ${esc(result.key)}</strong><br>
    Confidence: ${pct}% ${bar}
  </div>
</div>`;
        },
      });
      mount(container, 'key-detect', 'Key detection', el);
    },
  },

  {
    id: 'chord-shapes', group: 'Transforms', title: 'Chord diagrams',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'chord-shapes'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Chord diagrams</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';
      card.innerHTML = `
<div class="prose-block">
<p><code>getChordShape(name, instrument, song?)</code> returns fingering data for a chord — <strong>no SVG, no drawing</strong>. The library only provides the data structure:</p>
<pre class="prose-code">interface DiagramData {
  baseFret: number;       // fret where the shape starts
  frets: number[];        // per-string fret numbers (0=open, -1=muted)
  fingers?: number[];     // optional fingering labels
}</pre>
<p>The doc site draws the SVG fret grid from that data. The library includes seed tables for common open-position guitar and ukulele chords, plus any chords defined in the song with <code>{define:…}</code>.</p>
</div>
<div class="shapes-area">
  <div class="shapes-input-row">
    <input type="text" id="sh-input" class="chord-name-input" value="G" placeholder="Chord name" aria-label="Chord name for diagram" />
    <select id="sh-instr" class="instrument-select" aria-label="Instrument">
      <option value="guitar">Guitar (6-string)</option>
      <option value="ukulele">Ukulele (4-string)</option>
    </select>
  </div>
  <div id="sh-result" class="sh-result"></div>
  <div class="shapes-grid" id="shapes-grid"></div>
</div>`;

      sec.appendChild(card);
      container.appendChild(sec);

      const inp = card.querySelector<HTMLInputElement>('#sh-input')!;
      const instr = card.querySelector<HTMLSelectElement>('#sh-instr')!;
      const result = card.querySelector<HTMLElement>('#sh-result')!;
      const grid = card.querySelector<HTMLElement>('#shapes-grid')!;

      function updateShape() {
        const name = inp.value.trim();
        const instrument = instr.value as 'guitar' | 'ukulele';
        if (!name) { result.innerHTML = '<p class="dim">Enter a chord name.</p>'; return; }
        const shape = getChordShape(name, instrument);
        if (!shape) {
          result.innerHTML = `<p class="dim">No built-in shape for <strong>${esc(name)}</strong> (${instrument}). Try: C, G, Am, Dm, F, E.</p>`;
          return;
        }
        result.innerHTML = `<div class="diag-wrap large">${renderChordDiagram(name, shape)}</div>
<pre class="shape-data">${esc(JSON.stringify(shape, null, 2))}</pre>`;
      }

      // Show a grid of common chords
      function buildGrid() {
        const instrument = instr.value as 'guitar' | 'ukulele';
        const common = ['C', 'D', 'E', 'F', 'G', 'A', 'Am', 'Em', 'Dm', 'Bm', 'G7', 'Am7'];
        grid.innerHTML = common.map(name => {
          const shape = getChordShape(name, instrument);
          return shape ? `<div class="mini-diag">${renderChordDiagram(name, shape)}</div>` : '';
        }).join('');
      }

      const deb = debounce(updateShape, 200);
      inp.addEventListener('input', deb);
      instr.addEventListener('change', () => { updateShape(); buildGrid(); });
      updateShape(); buildGrid();
    },
  },

  // ── Tooling ──────────────────────────────────────────────────────────────────

  {
    id: 'tokenizer', group: 'Tooling', title: 'Tokenizer',
    build(container) {
      const { el } = docCard({
        prose: `
<p><code>tokenize(source)</code> returns a flat array of <code>Token</code> objects suitable for editor syntax highlighting:</p>
<pre class="prose-code">interface Token {
  type: 'metadata-directive' | 'section-open' | 'section-end'
      | 'directive' | 'chord' | 'annotation' | 'comment' | 'lyric';
  text: string;   // exact source slice
  start: number;  // byte offset (inclusive)
  end: number;    // byte offset (exclusive)
}</pre>
<p>A critical invariant: concatenating every token's <code>text</code> in order <strong>exactly reproduces the original source</strong>. The tokens tile the source without gaps or overlaps — this lets an app apply colour overlays character-by-character.</p>
<p>The library provides no colours — you map token <code>type</code> to your own theme. The legend below shows this doc site's mapping.</p>`,
        outputLabel: 'Colour-coded tokens',
        example: `{title: Tokenizer Demo}
{key: G}

# This line is a comment
{start_of_verse}
[G]Hello [Am7]world [*Coda]
Plain lyric text here.
{end_of_verse}`,
        onUpdate(src, output) {
          const tokens = tokenize(src);
          const body = renderTokens(tokens);
          output.innerHTML = `<div class="token-display">${body}</div><div class="tok-legend">${TOKEN_LEGEND}</div>`;
        },
      });
      mount(container, 'tokenizer', 'Tokenizer', el);
    },
  },

  {
    id: 'freetext', group: 'Tooling', title: 'Free-text import',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'freetext'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Free-text import</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';

      card.innerHTML = `
<div class="prose-block">
<p><code>parseFreeText(input)</code> converts loosely formatted chord sheets — the kind pasted from a word processor or typed by a musician — into canonical ChordPro. It applies detection rules in order:</p>
<ol>
  <li>First content line → <code>title</code></li>
  <li>Second content line → <code>artist</code></li>
  <li><code>Key:</code> / <code>Tom:</code> / <code>Tempo:</code> / <code>BPM:</code> / <code>Capo:</code> / <code>CCLI:</code> lines → metadata</li>
  <li>Section headings (<em>Verse 1</em>, <em>Chorus</em>, <em>[Bridge]</em>, Portuguese: <em>Verso</em>, <em>Refrão</em>) → environment pairs</li>
  <li>A line where ≥ 80% of tokens are recognisable chords + the next is lyrics → merged into inline <code>[C]word</code> form</li>
  <li>Everything else → lyric content</li>
</ol>
<p>The output is guaranteed to re-parse with <code>parse()</code> with zero unknown-directive warnings.</p>
</div>
<div class="ft-layout">
  <div class="ft-col">
    <div class="ft-input-header">
      <div class="pane-label">Free-text input (loose chord sheet)</div>
      <select id="ft-preset" class="instrument-select" aria-label="Load preset example"><option value="">Load example…</option></select>
    </div>
    <textarea id="ft-input" class="code-editor ft-editor" spellcheck="false" aria-label="Free-text input"></textarea>
  </div>
  <div class="ft-col">
    <div class="pane-label">parseFreeText() output</div>
    <div id="ft-meta" class="ft-meta-row"></div>
    <pre id="ft-output" class="ft-output-pre"></pre>
  </div>
</div>`;

      sec.appendChild(card);
      container.appendChild(sec);

      const ftInput = card.querySelector<HTMLTextAreaElement>('#ft-input')!;
      const ftMeta = card.querySelector<HTMLElement>('#ft-meta')!;
      const ftOutput = card.querySelector<HTMLPreElement>('#ft-output')!;
      const ftPreset = card.querySelector<HTMLSelectElement>('#ft-preset')!;

      FREE_TEXT_EXAMPLES.forEach((ex, i) => {
        const opt = document.createElement('option');
        opt.value = String(i); opt.textContent = ex.label;
        ftPreset.appendChild(opt);
      });

      ftInput.value = FREE_TEXT_EXAMPLE;

      ftPreset.addEventListener('change', () => {
        const idx = parseInt(ftPreset.value);
        if (isNaN(idx)) return;
        const ex = FREE_TEXT_EXAMPLES[idx];
        if (!ex) return;
        ftInput.value = ex.source;
        ftPreset.value = '';
        updateFt();
      });

      function updateFt() {
        const { chordpro, metadata } = parseFreeText(ftInput.value);
        ftMeta.innerHTML = [...metadata.entries()]
          .map(([k, v]) => `<span class="meta-pill"><span class="meta-key">${esc(k)}</span><span class="meta-val">${esc(v.slice(0, 30))}</span></span>`)
          .join('') || '<em class="dim">No metadata detected</em>';
        ftOutput.textContent = chordpro;
      }

      const deb = debounce(updateFt, 200);
      ftInput.addEventListener('input', deb);
      updateFt();
    },
  },

  {
    id: 'roundtrip', group: 'Tooling', title: 'Round-trip fidelity',
    build(container) {
      const { el } = docCard({
        prose: `
<p>The guiding policy: <em>"Recognize and round-trip the entire format; implement semantics only for the well-defined subset; never silently drop anything."</em></p>
<p><code>serialize(parse(x))</code> reproduces all directives — including the preserve-only tail of legacy font, colour, and layout directives — in their original spelling and document order. Comments, blank lines, delegated environment content, and custom <code>x_</code> directives all survive the round-trip intact.</p>
<p>Note that minor whitespace normalization between a directive name and its argument is allowed and documented. The meaningful content is guaranteed to be preserved.</p>`,
        example: `{title: Round-trip Test}
{textfont: Arial}
{chordcolour: #336699}

# This comment must survive

{start_of_verse}
[Am]Word [G]two [F]three
{end_of_verse}

{start_of_abc}
X:1
K:Am
G2AB | c2BA |
{end_of_abc}

{x_custom: preserved}
{new_page}`,
        outputLabel: 'Original → serialize(parse(x))',
        onUpdate(src, output) {
          const song = parse(src);
          const serialized = serialize(song);
          const reparsed = parse(serialized);
          const metaOk = [...song.metadata].every(([k, v]) => reparsed.metadata.get(k) === v);
          const linesOk = reparsed.lines.length === song.lines.length;
          const icon = (ok: boolean) => `<span class="${ok ? 'ok' : 'fail'}">${ok ? '✓' : '✗'}</span>`;
          output.innerHTML = `
<div class="rt-checks">
  <div class="rt-check">${icon(metaOk)} Metadata preserved</div>
  <div class="rt-check">${icon(linesOk)} Line count: ${song.lines.length} → ${reparsed.lines.length}</div>
</div>
<div class="rt-split">
  <div><div class="pane-label">Original</div><pre class="rt-pre">${esc(src)}</pre></div>
  <div><div class="pane-label">Serialized</div><pre class="rt-pre">${esc(serialized)}</pre></div>
</div>`;
        },
      });
      mount(container, 'roundtrip', 'Round-trip fidelity', el);
    },
  },

  {
    id: 'warnings', group: 'Tooling', title: 'Warnings & recovery',
    build(container) {
      const { el } = docCard({
        prose: `
<p>The parser <strong>never throws</strong>. Malformed input — unclosed brackets, unknown directives, unmatched section ends — is recovered from gracefully. Warnings are non-fatal <code>Warning</code> objects collected in <code>song.warnings</code>:</p>
<pre class="prose-code">interface Warning {
  line: number;    // 1-based line number
  column?: number;
  code: string;    // machine-readable code (UNKNOWN_DIRECTIVE, UNCLOSED_SECTION…)
  message: string;
}</pre>
<p>The example below is deliberately broken. Notice the parser still extracts the valid content that comes after the errors.</p>`,
        example: `{title: Missing close brace

# Unclosed section below:
{start_of_verse}
[G]Orphaned verse line

# Unmatched end directive:
{end_of_chorus}

# Unclosed chord bracket:
[G This bracket never closes

# Unknown directive:
{not_a_known_directive: oops}

# But parsing continues and this still works:
{title: Recovery Demo}
[G]Valid [C]chord [D]line [G]`,
        outputLabel: 'Warnings + rendered output',
        onUpdate(src, output) {
          const song = parse(src);
          const wHtml = warningsHtml(song.warnings);
          const rendered = renderedPreview(renderHtml(song, { includeHeader: true }));
          output.innerHTML = `<div class="warn-section">${wHtml}</div>${rendered}`;
        },
      });
      mount(container, 'warnings', 'Warnings & recovery', el);
    },
  },

  {
    id: 'directives-ref', group: 'Tooling', title: 'Directives reference',
    build(container) {
      const sec = document.createElement('section');
      sec.id = 'directives-ref'; sec.className = 'doc-section';
      sec.innerHTML = '<h2 class="section-title">Directives reference</h2>';

      const card = document.createElement('div');
      card.className = 'doc-card';

      const prose = document.createElement('div');
      prose.className = 'prose-block';
      prose.innerHTML = `<p><code>KNOWN_DIRECTIVES</code> is a typed array exported from the library. It drives this table — the doc site reads the same data your toolbar would. Use it to build a directive palette in your editor rather than maintaining a hand-kept copy.</p>`;
      card.appendChild(prose);

      const cats: Record<string, string> = {
        preamble: 'Preamble', metadata: 'Metadata', 'tier2-metadata': 'Tier-2 metadata',
        formatting: 'Formatting', 'environment-open': 'Env open', 'environment-close': 'Env close',
        'chord-def': 'Chord def', transposition: 'Transposition', 'output-layout': 'Layout/legacy',
      };

      const filterInput = document.createElement('input');
      filterInput.type = 'text'; filterInput.className = 'ext-filter';
      filterInput.placeholder = 'Filter directives…'; filterInput.setAttribute('aria-label', 'Filter directives');
      card.appendChild(filterInput);

      const tbody = document.createElement('tbody');
      const table = document.createElement('table');
      table.className = 'data-table dir-table';
      table.innerHTML = '<thead><tr><th>Directive</th><th>Aliases</th><th>Category</th><th>Arg?</th></tr></thead>';
      table.appendChild(tbody);
      card.appendChild(table);

      function renderTable(filter: string) {
        const f = filter.toLowerCase();
        const rows = KNOWN_DIRECTIVES
          .filter(d => !f || d.name.includes(f) || d.aliases.some(a => a.includes(f)))
          .map(d => `<tr><td><code>{${esc(d.name)}}</code></td><td>${d.aliases.map(a => `<code>${esc(a)}</code>`).join(' ')}</td><td>${cats[d.category] ?? d.category}</td><td>${d.takesArg ? 'yes' : '—'}</td></tr>`)
          .join('');
        tbody.innerHTML = rows || '<tr><td colspan="4" class="dim">No matches.</td></tr>';
      }
      renderTable('');
      filterInput.addEventListener('input', () => renderTable(filterInput.value));

      sec.appendChild(card);
      container.appendChild(sec);
    },
  },

  // ── Playground ───────────────────────────────────────────────────────────────

  {
    id: 'playground', group: 'Playground', title: 'Scratch pad',
    build(container) {
      // Full-featured tool — imported from the original playground logic
      buildScratchPad(container);
    },
  },
];

// ─── Mount helper ─────────────────────────────────────────────────────────────

function mount(container: HTMLElement, id: string, title: string, card: HTMLElement) {
  const sec = document.createElement('section');
  sec.id = id; sec.className = 'doc-section';
  const h2 = document.createElement('h2');
  h2.className = 'section-title'; h2.textContent = title;
  sec.appendChild(h2);
  sec.appendChild(card);
  container.appendChild(sec);
}

// ─── Scratch pad (original all-in-one tool) ───────────────────────────────────

function buildScratchPad(container: HTMLElement) {
  const sec = document.createElement('section');
  sec.id = 'playground'; sec.className = 'doc-section';
  sec.innerHTML = `<h2 class="section-title">Scratch pad</h2>
<div class="doc-card">
<div class="prose-block">
<p>A full-featured editor for pasting complete songs and exploring all output views at once — the original playground tool. Each section above demonstrates one concept; this is the power tool for anything-goes exploration.</p>
</div>
<div class="scratch-shell">
  <div class="scratch-left">
    <div class="scratch-input-header"><label for="sc-input" class="pane-label">ChordPro source</label><span id="sc-lines" class="dim"></span></div>
    <textarea id="sc-input" class="code-editor scratch-editor" spellcheck="false"></textarea>
    <div class="scratch-controls">
      <div class="ctrl-row"><span class="ctrl-label">Mode</span>
        <label class="tp-radio"><input type="radio" name="sc-mode" value="strict" checked> Strict</label>
        <label class="tp-radio"><input type="radio" name="sc-mode" value="relaxed"> Relaxed</label>
      </div>
      <div class="ctrl-row"><span class="ctrl-label">Transpose</span>
        <div class="stepper">
          <button class="tp-btn" id="sc-down">−</button>
          <span id="sc-offset">0</span>
          <button class="tp-btn" id="sc-up">+</button>
          <button class="tp-reset" id="sc-reset">↺</button>
        </div>
      </div>
      <div class="ctrl-row"><span class="ctrl-label">Accidentals</span>
        <label class="tp-radio"><input type="radio" name="sc-acc" value="auto" checked> Auto</label>
        <label class="tp-radio"><input type="radio" name="sc-acc" value="sharps"> Sharps</label>
        <label class="tp-radio"><input type="radio" name="sc-acc" value="flats"> Flats</label>
      </div>
      <div class="ctrl-row">
        <select id="sc-examples" class="instrument-select"><option value="">Load example…</option></select>
      </div>
    </div>
  </div>
  <div class="scratch-right">
    <div class="sc-tabs" role="tablist">
      <button role="tab" class="sc-tab active" data-sctab="rendered">Rendered</button>
      <button role="tab" class="sc-tab" data-sctab="text">Text</button>
      <button role="tab" class="sc-tab" data-sctab="ast">AST</button>
      <button role="tab" class="sc-tab" data-sctab="tokens">Tokens</button>
      <button role="tab" class="sc-tab" data-sctab="rt">Round-trip</button>
    </div>
    <div class="sc-panel-wrap">
      <div id="sc-panel-rendered" class="sc-panel active"></div>
      <div id="sc-panel-text" class="sc-panel" hidden><pre></pre></div>
      <div id="sc-panel-ast" class="sc-panel" hidden><pre></pre></div>
      <div id="sc-panel-tokens" class="sc-panel" hidden><div class="token-display"></div><div class="tok-legend"></div></div>
      <div id="sc-panel-rt" class="sc-panel" hidden></div>
    </div>
    <div id="sc-warnings" class="sc-warnings" hidden></div>
  </div>
</div>
</div>`;

  container.appendChild(sec);

  const input = sec.querySelector<HTMLTextAreaElement>('#sc-input')!;
  const linesEl = sec.querySelector<HTMLElement>('#sc-lines')!;
  const examplesSel = sec.querySelector<HTMLSelectElement>('#sc-examples')!;
  const offsetEl = sec.querySelector<HTMLElement>('#sc-offset')!;
  const warningsEl = sec.querySelector<HTMLElement>('#sc-warnings')!;

  // Populate examples
  EXAMPLES.forEach((ex, i) => {
    const opt = document.createElement('option');
    opt.value = String(i); opt.textContent = ex.label;
    examplesSel.appendChild(opt);
  });

  input.value = EXAMPLES[0]?.source ?? '';

  let scOffset = 0;

  function getMode(): ParseOptions['chordMode'] {
    return (sec.querySelector<HTMLInputElement>('input[name="sc-mode"]:checked')?.value ?? 'strict') as 'strict' | 'relaxed';
  }
  function getAcc(): TransposeOptions {
    const v = sec.querySelector<HTMLInputElement>('input[name="sc-acc"]:checked')?.value ?? 'auto';
    return v === 'sharps' ? { preferSharps: true } : v === 'flats' ? { preferFlats: true } : {};
  }
  function getActiveTab() { return sec.querySelector<HTMLElement>('.sc-tab.active')?.dataset['sctab'] ?? 'rendered'; }

  function updateScratch() {
    const src = input.value;
    linesEl.textContent = `${src.split('\n').length} lines`;
    const song = parse(src, { chordMode: getMode() });
    const displaySong = scOffset !== 0 ? transpose(song, scOffset, getAcc()) : song;

    // Warnings
    if (song.warnings.length > 0) {
      warningsEl.hidden = false;
      warningsEl.innerHTML = `<strong>${song.warnings.length} warning${song.warnings.length !== 1 ? 's' : ''}</strong> ` + song.warnings.map(w => `<span class="warn-chip">${esc(w.code)}</span>`).join('');
    } else {
      warningsEl.hidden = true;
    }

    const tab = getActiveTab();
    const panel = sec.querySelector<HTMLElement>(`#sc-panel-${tab}`)!;

    if (tab === 'rendered') {
      panel.innerHTML = soundingKeyBar(displaySong) + renderedPreview(renderHtml(displaySong, { includeHeader: true }));
    } else if (tab === 'text') {
      panel.querySelector('pre')!.textContent = renderText(displaySong, { includeHeader: true });
    } else if (tab === 'ast') {
      panel.querySelector('pre')!.textContent = songToJson(displaySong);
    } else if (tab === 'tokens') {
      panel.querySelector('.token-display')!.innerHTML = renderTokens(tokenize(src));
      panel.querySelector('.tok-legend')!.innerHTML = TOKEN_LEGEND;
    } else if (tab === 'rt') {
      const serialized = serialize(song);
      const reparsed = parse(serialized);
      const metaOk = [...song.metadata].every(([k, v]) => reparsed.metadata.get(k) === v);
      panel.innerHTML = `<div class="rt-checks"><div class="rt-check"><span class="${metaOk ? 'ok' : 'fail'}">${metaOk ? '✓' : '✗'}</span> Metadata preserved</div></div><div class="rt-split"><div><div class="pane-label">Input</div><pre class="rt-pre">${esc(src)}</pre></div><div><div class="pane-label">Serialized</div><pre class="rt-pre">${esc(serialized)}</pre></div></div>`;
    }
  }

  const debouncedScratch = debounce(updateScratch, 200);
  input.addEventListener('input', debouncedScratch);
  sec.querySelectorAll('input[name="sc-mode"], input[name="sc-acc"]').forEach(el => el.addEventListener('change', updateScratch));

  sec.querySelector('#sc-down')!.addEventListener('click', () => { scOffset--; offsetEl.textContent = (scOffset > 0 ? '+' : '') + scOffset; updateScratch(); });
  sec.querySelector('#sc-up')!.addEventListener('click', () => { scOffset++; offsetEl.textContent = (scOffset > 0 ? '+' : '') + scOffset; updateScratch(); });
  sec.querySelector('#sc-reset')!.addEventListener('click', () => { scOffset = 0; offsetEl.textContent = '0'; updateScratch(); });

  examplesSel.addEventListener('change', () => {
    const idx = parseInt(examplesSel.value);
    if (isNaN(idx)) return;
    const ex = EXAMPLES[idx];
    if (!ex) return;
    input.value = ex.source;
    examplesSel.value = '';
    updateScratch();
  });

  sec.querySelectorAll<HTMLButtonElement>('.sc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      sec.querySelectorAll('.sc-tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      sec.querySelectorAll('.sc-panel').forEach(p => { (p as HTMLElement).classList.remove('active'); (p as HTMLElement).hidden = true; });
      btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
      const panel = sec.querySelector<HTMLElement>(`#sc-panel-${btn.dataset['sctab']}`)!;
      panel.classList.add('active'); panel.hidden = false;
      setTimeout(updateScratch, 0);
    });
  });

  updateScratch();
}
