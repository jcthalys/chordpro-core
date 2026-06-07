/**
 * Lyric line segmenter.
 * Splits a lyric line into Segment[] by parsing inline [Chord] and [*annotation] markers.
 */

import type { Segment, Chord } from '../model/types.js';
import { parseChord } from '../chords/parseChord.js';

export interface SegmenterOptions {
  chordMode?: 'strict' | 'relaxed';
  /** When true, treat [..] as literal (inside tab blocks). */
  verbatim?: boolean;
}

/**
 * Parse a lyric line (not inside a tab block) into ordered Segment[].
 * Handles: [Chord], [*annotation], mid-word chords, leading/trailing chords.
 */
export function segmentLine(line: string, options: SegmenterOptions = {}): Segment[] {
  if (options.verbatim) {
    return [{ lyric: line }];
  }

  const segments: Segment[] = [];
  const mode = options.chordMode ?? 'strict';

  let pos = 0;
  let pendingChord: Chord | undefined;
  let pendingAnnotation: string | undefined;
  let lyricBuf = '';

  while (pos < line.length) {
    const openIdx = line.indexOf('[', pos);
    if (openIdx === -1) {
      // Rest is lyric
      lyricBuf += line.slice(pos);
      break;
    }

    // Everything before [ is part of the current lyric segment
    lyricBuf += line.slice(pos, openIdx);

    const closeIdx = line.indexOf(']', openIdx + 1);
    if (closeIdx === -1) {
      // Unclosed bracket — treat the rest as lyric (robustness)
      lyricBuf += line.slice(openIdx);
      break;
    }

    const inner = line.slice(openIdx + 1, closeIdx);
    pos = closeIdx + 1;

    // If there was a pending chord/annotation from a previous bracket, emit a segment
    if (pendingChord !== undefined || pendingAnnotation !== undefined) {
      segments.push({
        ...(pendingChord !== undefined ? { chord: pendingChord } : {}),
        ...(pendingAnnotation !== undefined ? { annotation: pendingAnnotation } : {}),
        lyric: lyricBuf,
      });
      lyricBuf = '';
      pendingChord = undefined;
      pendingAnnotation = undefined;
    } else if (lyricBuf) {
      // Plain lyric run before first chord
      segments.push({ lyric: lyricBuf });
      lyricBuf = '';
    }

    if (inner.startsWith('*')) {
      // Annotation — strip *, never parse as chord
      pendingAnnotation = inner.slice(1);
    } else {
      pendingChord = parseChord(inner, { mode });
    }
  }

  // Emit any trailing chord/annotation (empty lyric)
  if (pendingChord !== undefined || pendingAnnotation !== undefined) {
    segments.push({
      ...(pendingChord !== undefined ? { chord: pendingChord } : {}),
      ...(pendingAnnotation !== undefined ? { annotation: pendingAnnotation } : {}),
      lyric: lyricBuf,
    });
  } else if (lyricBuf) {
    segments.push({ lyric: lyricBuf });
  }

  if (segments.length === 0) {
    segments.push({ lyric: '' });
  }

  return segments;
}
