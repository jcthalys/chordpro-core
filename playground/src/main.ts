import {
  parse,
  serialize,
  parseChord,
  transpose,
  tokenize,
  renderText,
  renderHtml,
  parseFreeText,
  getChordShape,
  KNOWN_DIRECTIVES,
  type Song,
  type Token,
  type TransposeOptions,
  type ParseOptions,
} from 'chordpro-core';

import { EXAMPLES, FREE_TEXT_EXAMPLE } from './examples.js';
import { renderChordDiagram } from './chordDiagram.js';

declare const __LIBRARY_VERSION__: string;

// ─── DOM elements ─────────────────────────────────────────────────────────────

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const inputEl = $<HTMLTextAreaElement>('#cp-input');
const lineCountEl = $<HTMLElement>('#line-count');
const examplesEl = $<HTMLSelectElement>('#examples-select');
const tabButtons = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
const tabPanels = document.querySelectorAll<HTMLElement>('.tab-panel');

const transposeDisplay = $<HTMLElement>('#transpose-display');
const transposeDown = $<HTMLButtonElement>('#transpose-down');
const transposeUp = $<HTMLButtonElement>('#transpose-up');
const transposeReset = $<HTMLButtonElement>('#transpose-reset');

const modeInputs = document.querySelectorAll<HTMLInputElement>('input[name="chord-mode"]');
const accidentalInputs = document.querySelectorAll<HTMLInputElement>('input[name="accidentals"]');

const warningsBar = $<HTMLElement>('#warnings-bar');
const warningCount = $<HTMLElement>('#warning-count');
const warningsList = $<HTMLElement>('#warnings-list');

const chordInput = $<HTMLInputElement>('#chord-input');
const instrumentSelect = $<HTMLSelectElement>('#instrument-select');
const chordInspectorResult = $<HTMLElement>('#chord-inspector-result');

const freetextInput = $<HTMLTextAreaElement>('#freetext-input');
const freetextResult = $<HTMLElement>('#freetext-result');

const versionEl = $<HTMLElement>('#library-version');

// ─── State ────────────────────────────────────────────────────────────────────

let transposeOffset = 0;
let currentSong: Song | null = null;
let debounceTimer = 0;

// ─── Populate examples dropdown ───────────────────────────────────────────────

EXAMPLES.forEach((ex, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = ex.label;
  examplesEl.appendChild(opt);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getChordMode(): ParseOptions['chordMode'] {
  for (const el of modeInputs) {
    if (el.checked) return el.value as 'strict' | 'relaxed';
  }
  return 'strict';
}

function getTransposeOptions(): TransposeOptions {
  for (const el of accidentalInputs) {
    if (el.checked) {
      if (el.value === 'sharps') return { preferSharps: true };
      if (el.value === 'flats') return { preferFlats: true };
    }
  }
  return {};
}

function updateLineCount() {
  const lines = inputEl.value.split('\n').length;
  lineCountEl.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tabId: string) {
  tabButtons.forEach((btn) => {
    const active = btn.dataset['tab'] === tabId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  tabPanels.forEach((panel) => {
    const active = panel.id === `panel-${tabId}`;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset['tab'];
    if (tab) switchTab(tab);
  });
});

// ─── Token type colors ────────────────────────────────────────────────────────

const TOKEN_COLORS: Record<Token['type'], string> = {
  'metadata-directive': 'var(--tok-meta)',
  'section-open': 'var(--tok-section-open)',
  'section-end': 'var(--tok-section-end)',
  'directive': 'var(--tok-directive)',
  'chord': 'var(--tok-chord)',
  'annotation': 'var(--tok-annotation)',
  'comment': 'var(--tok-comment)',
  'lyric': 'var(--tok-lyric)',
};

// ─── AST serialization (Map → plain object) ───────────────────────────────────

function songToJson(song: Song): string {
  return JSON.stringify(
    {
      metadata: Object.fromEntries(song.metadata),
      lines: song.lines,
      warnings: song.warnings,
    },
    null,
    2,
  );
}

// ─── Warnings strip ───────────────────────────────────────────────────────────

function showWarnings(song: Song) {
  if (song.warnings.length === 0) {
    warningsBar.hidden = true;
    return;
  }
  warningsBar.hidden = false;
  warningCount.textContent = `${song.warnings.length} warning${song.warnings.length !== 1 ? 's' : ''}`;
  warningsList.innerHTML = song.warnings
    .map(
      (w) =>
        `<div class="warning-item"><span class="warning-loc">Line ${w.line}</span><code class="warning-code">${esc(w.code)}</code><span class="warning-msg">${esc(w.message)}</span></div>`,
    )
    .join('');
}

// ─── Round-trip analysis ──────────────────────────────────────────────────────

function analyzeRoundTrip(original: string, song: Song): string {
  const serialized = serialize(song);
  const reparsed = parse(serialized, { chordMode: getChordMode() });

  const metaOk = [...song.metadata].every(([k, v]) => reparsed.metadata.get(k) === v);
  const linesOk = reparsed.lines.length === song.lines.length;
  const serializedWarnings = reparsed.warnings.filter((w) => w.code === 'UNKNOWN_DIRECTIVE').length;

  const statusIcon = (ok: boolean) => (ok ? '<span class="ok">✓</span>' : '<span class="fail">✗</span>');

  return `<div class="roundtrip-checks">
  <div class="rt-check">${statusIcon(metaOk)} <strong>Metadata preserved</strong>${metaOk ? '' : ' — some values changed'}</div>
  <div class="rt-check">${statusIcon(linesOk)} <strong>Line count</strong>: ${song.lines.length} → ${reparsed.lines.length}</div>
  <div class="rt-check">${statusIcon(serializedWarnings === 0)} <strong>No unknown directives</strong> in re-parsed output</div>
</div>
<div class="roundtrip-split">
  <div class="rt-col">
    <div class="rt-col-label">Original input (${original.split('\n').length} lines)</div>
    <pre class="rt-pre">${esc(original)}</pre>
  </div>
  <div class="rt-col">
    <div class="rt-col-label">serialize(parse(input)) (${serialized.split('\n').length} lines)</div>
    <pre class="rt-pre">${esc(serialized)}</pre>
  </div>
</div>`;
}

// ─── Main update function ──────────────────────────────────────────────────────

function update() {
  const source = inputEl.value;
  updateLineCount();

  const opts: ParseOptions = { chordMode: getChordMode() };
  const song = parse(source, opts);
  currentSong = song;

  // Apply transposition
  const transposeOpts = getTransposeOptions();
  const displaySong = transposeOffset !== 0 ? transpose(song, transposeOffset, transposeOpts) : song;

  showWarnings(song);

  // Update each tab panel (lazily — only if visible)
  const activeTab = document.querySelector<HTMLButtonElement>('[role="tab"].active')?.dataset['tab'];

  switch (activeTab) {
    case 'rendered':
      updateRendered(displaySong);
      break;
    case 'text':
      updateText(displaySong);
      break;
    case 'ast':
      updateAst(displaySong);
      break;
    case 'tokens':
      updateTokens(source);
      break;
    case 'roundtrip':
      updateRoundtrip(source, song);
      break;
    case 'chordinspector':
      updateChordInspector();
      break;
    case 'freetext':
      // free-text has its own update trigger
      break;
  }
}

function updateRendered(song: Song) {
  const html = renderHtml(song, { includeHeader: true });
  $<HTMLElement>('#panel-rendered .output-body').innerHTML = html;
}

function updateText(song: Song) {
  const text = renderText(song, { includeHeader: true });
  $<HTMLPreElement>('#panel-text pre').textContent = text;
}

function updateAst(song: Song) {
  $<HTMLPreElement>('#panel-ast pre').textContent = songToJson(song);
}

function updateTokens(source: string) {
  const tokens = tokenize(source);
  const body = $<HTMLElement>('#panel-tokens .token-body');
  body.innerHTML = tokens
    .map((tok) => {
      const color = TOKEN_COLORS[tok.type];
      const label = esc(tok.text);
      return `<span class="token token-${tok.type}" style="color:${color}" title="${esc(tok.type)}">${label}</span>`;
    })
    .join('');
}

function updateRoundtrip(source: string, song: Song) {
  $<HTMLElement>('#panel-roundtrip .roundtrip-content').innerHTML = analyzeRoundTrip(source, song);
}

// ─── Chord inspector ──────────────────────────────────────────────────────────

function updateChordInspector() {
  const name = chordInput.value.trim();
  if (!name) {
    chordInspectorResult.innerHTML = '<p class="inspector-hint">Type a chord name above (e.g. <code>Am7b5</code>, <code>Fmaj7/A</code>, <code>G7sus4</code>)</p>';
    return;
  }

  const strictChord = parseChord(name, { mode: 'strict' });
  const relaxedChord = parseChord(name, { mode: 'relaxed' });
  const instrument = instrumentSelect.value as 'guitar' | 'ukulele';
  const song = currentSong ?? undefined;
  const shape = getChordShape(name, instrument, song);

  const row = (label: string, val: string | undefined, cls = '') =>
    `<tr><td class="prop-label">${label}</td><td class="prop-value ${cls}">${val ?? '<em class="none">—</em>'}</td></tr>`;

  const chordTable = (chord: ReturnType<typeof parseChord>, mode: string) => `
    <table class="prop-table">
      <caption>${mode}</caption>
      ${row('Parsed', chord.parsed ? '✓ yes' : '✗ no', chord.parsed ? 'ok' : 'fail')}
      ${row('Root', chord.root)}
      ${row('Qualifier', chord.qualifier)}
      ${row('Extension', chord.extension)}
      ${row('Bass', chord.bass)}
    </table>`;

  const diagramHtml = shape
    ? `<div class="diagram-wrap">${renderChordDiagram(name, shape)}</div>`
    : `<p class="no-diagram">No shape found for <em>${esc(name)}</em> (${instrument})</p>`;

  chordInspectorResult.innerHTML = `
    <div class="inspector-grid">
      <div class="inspector-tables">
        ${chordTable(strictChord, 'Strict mode')}
        ${chordTable(relaxedChord, 'Relaxed mode')}
      </div>
      <div class="inspector-diagram">${diagramHtml}</div>
    </div>`;
}

chordInput.addEventListener('input', updateChordInspector);
instrumentSelect.addEventListener('change', updateChordInspector);

// ─── Free-text converter ──────────────────────────────────────────────────────

function updateFreetext() {
  const input = freetextInput.value;
  if (!input.trim()) {
    freetextResult.innerHTML = '<p class="inspector-hint">Paste loose chord-sheet text above.</p>';
    return;
  }

  const { chordpro, metadata, warnings } = parseFreeText(input);

  const pills = [...metadata.entries()]
    .map(([k, v]) => `<span class="meta-pill"><span class="meta-key">${esc(k)}</span><span class="meta-val">${esc(v)}</span></span>`)
    .join('');

  const warnHtml =
    warnings.length > 0
      ? `<div class="ft-warnings">${warnings.map((w) => `<div>${esc(w.message)}</div>`).join('')}</div>`
      : '';

  freetextResult.innerHTML = `
    <div class="ft-meta">${pills || '<em>No metadata detected</em>'}</div>
    ${warnHtml}
    <pre class="ft-output">${esc(chordpro)}</pre>
    <button class="btn-load" id="ft-load">Load in main editor →</button>`;

  $<HTMLButtonElement>('#ft-load').addEventListener('click', () => {
    inputEl.value = chordpro;
    switchTab('rendered');
    update();
  });
}

freetextInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(updateFreetext, 200);
});

// Seed free-text with sample
freetextInput.value = FREE_TEXT_EXAMPLE;

// ─── Transpose controls ───────────────────────────────────────────────────────

function updateTransposeDisplay() {
  const sign = transposeOffset > 0 ? '+' : '';
  transposeDisplay.textContent = `${sign}${transposeOffset}`;
  transposeDisplay.className = transposeOffset !== 0 ? 'transpose-nonzero' : '';
}

transposeDown.addEventListener('click', () => {
  transposeOffset--;
  updateTransposeDisplay();
  update();
});

transposeUp.addEventListener('click', () => {
  transposeOffset++;
  updateTransposeDisplay();
  update();
});

transposeReset.addEventListener('click', () => {
  transposeOffset = 0;
  updateTransposeDisplay();
  update();
});

// ─── Examples dropdown ────────────────────────────────────────────────────────

examplesEl.addEventListener('change', () => {
  const idx = parseInt(examplesEl.value);
  if (isNaN(idx)) return;
  const ex = EXAMPLES[idx];
  if (!ex) return;
  inputEl.value = ex.source;
  transposeOffset = 0;
  updateTransposeDisplay();
  examplesEl.value = '';
  update();
});

// ─── Controls → re-render ────────────────────────────────────────────────────

modeInputs.forEach((el) => el.addEventListener('change', update));
accidentalInputs.forEach((el) => el.addEventListener('change', update));

// ─── Tab panel updates on tab switch ─────────────────────────────────────────

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    // Re-render for the newly visible tab
    setTimeout(update, 0);
  });
});

// ─── Debounced input ──────────────────────────────────────────────────────────

inputEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(update, 200);
});

// ─── Warnings toggle ──────────────────────────────────────────────────────────

$<HTMLButtonElement>('#warnings-toggle').addEventListener('click', () => {
  const expanded = warningsList.classList.toggle('expanded');
  $<HTMLButtonElement>('#warnings-toggle').textContent = expanded ? '▴' : '▾';
});

// ─── Directive reference table ────────────────────────────────────────────────

function buildDirectiveTable() {
  const tbody = $<HTMLTableSectionElement>('#directive-table tbody');
  if (!tbody) return;
  const cats: Record<string, string> = {
    'preamble': 'Preamble',
    'metadata': 'Metadata',
    'tier2-metadata': 'Tier-2 metadata',
    'formatting': 'Formatting',
    'environment-open': 'Env open',
    'environment-close': 'Env close',
    'chord-def': 'Chord def',
    'transposition': 'Transposition',
    'output-layout': 'Layout/legacy',
  };
  KNOWN_DIRECTIVES.forEach((d) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><code>{${d.name}}</code></td><td>${d.aliases.map((a) => `<code>${a}</code>`).join(', ')}</td><td>${cats[d.category] ?? d.category}</td><td>${d.takesArg ? 'yes' : 'no'}</td>`;
    tbody.appendChild(tr);
  });
}

// ─── Version in footer ───────────────────────────────────────────────────────

if (versionEl) versionEl.textContent = `chordpro-core v${__LIBRARY_VERSION__}`;

// ─── Init ─────────────────────────────────────────────────────────────────────

buildDirectiveTable();
switchTab('rendered');
update();
updateFreetext();
