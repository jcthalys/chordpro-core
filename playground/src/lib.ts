/**
 * Shared UI helpers for the documentation sections.
 * No library internals — public API only.
 */

import type { Song, Warning } from 'chordpro-core';

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): () => void {
  let t = 0;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

export function songToJson(song: Song): string {
  return JSON.stringify({ metadata: Object.fromEntries(song.metadata), lines: song.lines, warnings: song.warnings }, null, 2);
}

export function warningsHtml(warnings: Warning[]): string {
  if (warnings.length === 0) return '<p class="no-warnings">No warnings — parse recovered cleanly.</p>';
  return `<ul class="warn-list">${warnings.map((w) =>
    `<li><span class="warn-loc">line ${w.line}</span><code class="warn-code">${esc(w.code)}</code><span class="warn-msg">${esc(w.message)}</span></li>`
  ).join('')}</ul>`;
}

export function metaTableHtml(song: Song): string {
  if (song.metadata.size === 0) return '<p class="dim">No metadata directives found.</p>';
  const rows = [...song.metadata.entries()]
    .map(([k, v]) => `<tr><td class="meta-key">${esc(k)}</td><td class="meta-val">${esc(v)}</td></tr>`)
    .join('');
  return `<table class="meta-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

export interface CardOpts {
  prose: string;
  example: string;
  outputLabel?: string;
  /** Controls HTML string inserted between editor and output panes */
  controlsHtml?: string;
  onUpdate(source: string, output: HTMLElement, controls: HTMLElement | null): void;
}

export interface CardHandles {
  el: HTMLElement;
  editor: HTMLTextAreaElement;
  output: HTMLElement;
  controls: HTMLElement | null;
}

/** Creates a standard doc card: prose block + split editor/output. */
export function docCard(opts: CardOpts): CardHandles {
  const el = document.createElement('div');
  el.className = 'doc-card';

  // Prose
  const prose = document.createElement('div');
  prose.className = 'prose-block';
  prose.innerHTML = opts.prose;
  el.appendChild(prose);

  // Example area
  const area = document.createElement('div');
  area.className = 'example-area';
  el.appendChild(area);

  // Input pane
  const inputPane = document.createElement('div');
  inputPane.className = 'example-pane input-pane';
  const inputLbl = document.createElement('div');
  inputLbl.className = 'pane-label';
  inputLbl.textContent = 'Editor';
  inputPane.appendChild(inputLbl);
  const editor = document.createElement('textarea');
  editor.className = 'code-editor';
  editor.spellcheck = false;
  editor.value = opts.example;
  inputPane.appendChild(editor);
  area.appendChild(inputPane);

  // Controls
  let controls: HTMLElement | null = null;
  if (opts.controlsHtml) {
    controls = document.createElement('div');
    controls.className = 'card-controls';
    controls.innerHTML = opts.controlsHtml;
    area.appendChild(controls);
  }

  // Output pane
  const outputPane = document.createElement('div');
  outputPane.className = 'example-pane output-pane';
  const outputLbl = document.createElement('div');
  outputLbl.className = 'pane-label';
  outputLbl.textContent = opts.outputLabel ?? 'Output';
  outputPane.appendChild(outputLbl);
  const output = document.createElement('div');
  output.className = 'example-output';
  outputPane.appendChild(output);
  area.appendChild(outputPane);

  const update = debounce(() => opts.onUpdate(editor.value, output, controls), 200);
  editor.addEventListener('input', update);
  // Initial render (sync)
  opts.onUpdate(editor.value, output, controls);

  return { el, editor, output, controls };
}

/** Wraps a docCard in a <section> with heading. */
export function buildSection(opts: {
  id: string;
  title: string;
  card: CardHandles;
}): HTMLElement {
  const sec = document.createElement('section');
  sec.id = opts.id;
  sec.className = 'doc-section';
  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent = opts.title;
  sec.appendChild(h2);
  sec.appendChild(opts.card.el);
  return sec;
}

// ─── Rendered song HTML ───────────────────────────────────────────────────────

/** Creates a preview area that receives renderHtml() output + applies cp-* styles. */
export function renderedPreview(html: string): string {
  return `<div class="rendered-preview">${html}</div>`;
}

// ─── Token rendering ──────────────────────────────────────────────────────────

import type { Token } from 'chordpro-core';

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

export function renderTokens(tokens: Token[]): string {
  return tokens
    .map((t) => `<span class="tok tok-${t.type}" style="color:${TOKEN_COLORS[t.type]}" title="${esc(t.type)}">${esc(t.text)}</span>`)
    .join('');
}

export const TOKEN_LEGEND = Object.entries(TOKEN_COLORS)
  .map(([type, color]) => `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${type}</span>`)
  .join('');
