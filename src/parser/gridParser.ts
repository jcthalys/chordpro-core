/**
 * Parse a grid row line into bar-separated chord cells.
 */

import type { GridRow, GridCell } from '../model/types.js';
import { parseChord } from '../chords/parseChord.js';

/**
 * Parse a line inside start_of_grid/end_of_grid into a GridRow.
 * Bar structure preserved: cells separated by `|`.
 * Original source line is stored for lossless round-trip.
 */
export function parseGridRow(line: string): GridRow {
  const cellTexts = line.split('|');
  const cells: GridCell[] = cellTexts.map((cell) => {
    const tokens = cell.trim().split(/\s+/).filter(Boolean);
    const chords = tokens.map((t) => parseChord(t, { mode: 'relaxed' }));
    return { chords };
  });
  return { type: 'grid_row', cells, source: line };
}
