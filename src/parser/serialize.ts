/**
 * Serialize a Song AST back to ChordPro source.
 * Round-trips all content faithfully: original directive spellings, chord names,
 * comments, metadata order, and preserve-only tail directives.
 */

import type {
  Song,
  Line,
  LyricLine,
  SectionNode,
  Segment,
} from '../model/types.js';

/** Serialize a Song to ChordPro source text. */
export function serialize(song: Song): string {
  return song.lines.map(serializeLine).join('\n');
}

function serializeLine(line: Line): string {
  switch (line.type) {
    case 'blank':
      return '';
    case 'comment':
      return line.text;
    case 'directive':
      return line.source;
    case 'lyric':
      return serializeLyricLine(line);
    case 'section':
      return serializeSection(line);
    case 'chorus_reference':
      return line.source;
    case 'tab_line':
      return line.text;
    case 'grid_row':
      // Use stored source for perfect round-trip; fall back to reconstruction when transposed
      if (line.source !== undefined) return line.source;
      return line.cells.map((c) => c.chords.map((ch) => ch.name).join(' ')).join(' | ');
  }
}

function serializeLyricLine(line: LyricLine): string {
  return line.segments.map(serializeSegment).join('');
}

function serializeSegment(seg: Segment): string {
  let prefix = '';
  if (seg.chord !== undefined) {
    prefix = `[${seg.chord.name}]`;
  } else if (seg.annotation !== undefined) {
    prefix = `[*${seg.annotation}]`;
  }
  return prefix + seg.lyric;
}

function serializeSection(section: SectionNode): string {
  const parts: string[] = [section.openSource];

  if (section.delegated && section.rawContent !== undefined) {
    if (section.rawContent) parts.push(section.rawContent);
  } else {
    for (const child of section.lines) {
      parts.push(serializeLine(child));
    }
  }

  parts.push(section.closeSource);
  return parts.join('\n');
}
