/**
 * Plain-text renderer: chords aligned above lyrics in monospace.
 * Produces "a" rendering, not "the" rendering (see §0).
 */

import type { Song, Line, LyricLine, SectionNode } from '../model/types.js';
import { applyTransposeDirectives } from '../chords/transpose.js';

export interface TextRenderOptions {
  /** Include metadata header (title/artist/key) at top. Default: true. */
  includeHeader?: boolean;
  /** Column width for monospace alignment. Default: 80. */
  columnWidth?: number;
}

/** Render a Song to chords-over-lyrics plain text. */
export function renderText(song: Song, options: TextRenderOptions = {}): string {
  song = applyTransposeDirectives(song);
  const includeHeader = options.includeHeader ?? true;
  const parts: string[] = [];

  if (includeHeader) {
    const title = song.metadata.get('title');
    const artist = song.metadata.get('artist');
    const key = song.metadata.get('key');
    if (title) parts.push(title);
    if (artist) parts.push(artist);
    if (key) parts.push(`Key: ${key}`);
    if (parts.length > 0) parts.push('');
  }

  for (const line of song.lines) {
    const rendered = renderLineText(line);
    if (rendered !== null) parts.push(rendered);
  }

  return parts.join('\n');
}

function renderLineText(line: Line): string | null {
  switch (line.type) {
    case 'blank':
      return '';
    case 'comment':
      return null; // omit raw # comments from rendered output
    case 'directive': {
      // Show comment-style directives as text
      if (['comment', 'comment_italic', 'comment_box'].includes(line.name)) {
        return line.argument ?? '';
      }
      return null;
    }
    case 'lyric':
      return renderLyricLineText(line);
    case 'section':
      return renderSectionText(line);
    case 'chorus_reference':
      return '[Chorus]';
    case 'tab_line':
      return line.text;
    case 'grid_row':
      return '| ' + line.cells.map((c) => c.chords.map((ch) => ch.name).join(' ')).join(' | ') + ' |';
    case 'chord_def':
      return null; // chord definitions are not rendered as text
  }
}

function renderLyricLineText(line: LyricLine): string {
  // Check if there are any chords
  const hasChords = line.segments.some((s) => s.chord !== undefined || s.annotation !== undefined);
  if (!hasChords) {
    return line.segments.map((s) => s.lyric).join('');
  }

  // Build chord row and lyric row with proper alignment
  let chordRow = '';
  let lyricRow = '';

  for (const seg of line.segments) {
    const lyric = seg.lyric;
    const chordText = seg.chord?.name ?? seg.annotation ?? '';

    const colWidth = Math.max(chordText.length + 1, lyric.length);

    chordRow += chordText.padEnd(colWidth);
    lyricRow += lyric.padEnd(colWidth);
  }

  return chordRow.trimEnd() + '\n' + lyricRow.trimEnd();
}

function renderSectionText(section: SectionNode): string {
  const parts: string[] = [];

  if (section.kind !== 'tab') {
    const label = section.label ?? capitalize(section.kind);
    parts.push(`[${label}]`);
  }

  if (section.delegated) {
    if (section.rawContent) parts.push(section.rawContent);
    return parts.join('\n');
  }

  for (const child of section.lines) {
    const rendered = renderLineText(child);
    if (rendered !== null) parts.push(rendered);
  }

  return parts.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
