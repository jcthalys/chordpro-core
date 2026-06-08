/**
 * HTML string renderer. Emits semantic, class-annotated markup.
 * Returns a string — never DOM nodes. "a" rendering, not "the" rendering.
 *
 * Class names (application may style or ignore):
 *   .cp-song, .cp-header, .cp-title, .cp-artist, .cp-key
 *   .cp-section, .cp-section--chorus, .cp-section--verse, .cp-section--bridge, etc.
 *   .cp-section-label
 *   .cp-lyric-line, .cp-chord-row, .cp-lyric-row
 *   .cp-segment, .cp-chord, .cp-annotation, .cp-lyric
 *   .cp-comment, .cp-comment-italic, .cp-comment-box
 *   .cp-chorus-ref
 *   .cp-tab, .cp-grid
 *   .cp-blank
 */

import type { Song, Line, LyricLine, SectionNode, Segment } from '../model/types.js';
import { applyTransposeDirectives } from '../chords/transpose.js';

export interface HtmlRenderOptions {
  /** Include metadata header. Default: true. */
  includeHeader?: boolean;
}

/** Render a Song to an HTML string with semantic class annotations. */
export function renderHtml(song: Song, options: HtmlRenderOptions = {}): string {
  song = applyTransposeDirectives(song);
  const includeHeader = options.includeHeader ?? true;
  const parts: string[] = [];

  if (includeHeader) {
    const title = song.metadata.get('title');
    const artist = song.metadata.get('artist');
    const key = song.metadata.get('key');
    const headerParts: string[] = [];
    if (title) headerParts.push(`<h1 class="cp-title">${esc(title)}</h1>`);
    if (artist) headerParts.push(`<p class="cp-artist">${esc(artist)}</p>`);
    if (key) headerParts.push(`<p class="cp-key">Key: ${esc(key)}</p>`);
    if (headerParts.length > 0) {
      parts.push(`<header class="cp-header">${headerParts.join('')}</header>`);
    }
  }

  for (const line of song.lines) {
    const rendered = renderLineHtml(line);
    if (rendered !== null) parts.push(rendered);
  }

  return `<div class="cp-song">${parts.join('\n')}</div>`;
}

function renderLineHtml(line: Line): string | null {
  switch (line.type) {
    case 'blank':
      return `<div class="cp-blank"></div>`;
    case 'comment':
      return null; // raw # comments omitted
    case 'directive': {
      if (line.name === 'comment') {
        return `<p class="cp-comment">${esc(line.argument ?? '')}</p>`;
      }
      if (line.name === 'comment_italic') {
        return `<p class="cp-comment cp-comment-italic"><em>${esc(line.argument ?? '')}</em></p>`;
      }
      if (line.name === 'comment_box') {
        return `<p class="cp-comment cp-comment-box">${esc(line.argument ?? '')}</p>`;
      }
      return null;
    }
    case 'lyric':
      return renderLyricLineHtml(line);
    case 'section':
      return renderSectionHtml(line);
    case 'chorus_reference':
      return `<div class="cp-chorus-ref">${esc(line.label ?? 'Chorus')}</div>`;
    case 'tab_line':
      return `<code class="cp-tab-line">${esc(line.text)}</code>`;
    case 'grid_row': {
      const cells = line.cells
        .map((c) => `<span class="cp-grid-cell">${c.chords.map((ch) => `<span class="cp-chord">${esc(ch.name)}</span>`).join(' ')}</span>`)
        .join('<span class="cp-grid-bar">|</span>');
      return `<div class="cp-grid-row">${cells}</div>`;
    }
    case 'chord_def':
      return null; // chord definitions are not rendered
  }
}

function renderLyricLineHtml(line: LyricLine): string {
  const hasChords = line.segments.some((s) => s.chord !== undefined || s.annotation !== undefined);

  if (!hasChords) {
    const lyric = line.segments.map((s) => esc(s.lyric)).join('');
    return `<div class="cp-lyric-line"><span class="cp-lyric">${lyric}</span></div>`;
  }

  const segs = line.segments.map(renderSegmentHtml).join('');
  return `<div class="cp-lyric-line">${segs}</div>`;
}

function renderSegmentHtml(seg: Segment): string {
  const chordHtml = seg.chord !== undefined
    ? `<span class="cp-chord">${esc(seg.chord.name)}</span>`
    : seg.annotation !== undefined
      ? `<span class="cp-annotation">${esc(seg.annotation)}</span>`
      : '';
  const lyricHtml = `<span class="cp-lyric">${esc(seg.lyric)}</span>`;
  return `<span class="cp-segment">${chordHtml}${lyricHtml}</span>`;
}

function renderSectionHtml(section: SectionNode): string {
  const kindClass = `cp-section--${section.kind}`;
  const labelHtml = section.label
    ? `<div class="cp-section-label">${esc(section.label)}</div>`
    : '';

  if (section.delegated) {
    const content = section.rawContent ? esc(section.rawContent) : '';
    return `<div class="cp-section ${kindClass}">${labelHtml}<pre class="cp-delegated">${content}</pre></div>`;
  }

  if (section.kind === 'tab') {
    const lines = section.lines.map(renderLineHtml).filter(Boolean).join('\n');
    return `<pre class="cp-tab">${lines}</pre>`;
  }

  if (section.kind === 'grid') {
    const rows = section.lines.map(renderLineHtml).filter(Boolean).join('\n');
    return `<div class="cp-section ${kindClass} cp-grid">${labelHtml}${rows}</div>`;
  }

  const inner = section.lines.map(renderLineHtml).filter(Boolean).join('\n');
  return `<div class="cp-section ${kindClass}">${labelHtml}${inner}</div>`;
}

/** Escape HTML special characters. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
