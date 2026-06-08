/**
 * resolveChorus — Tier 1 utility.
 * Resolves a ChorusReference to the SectionNode it refers to, following
 * the ChordPro spec selection rule:
 *   "applies to the last definition that precedes this directive"
 *   (matching by label when one is given, otherwise any chorus).
 *
 * Scope decision (spec-verified): only top-level `song.lines` are searched.
 * The ChordPro spec describes `{start_of_chorus}` as a top-level environment;
 * a chorus nested inside another section (e.g. inside a verse) is non-canonical
 * usage and is intentionally not resolved here. The reference program (chordpro.org)
 * exhibits the same top-level-only behavior.
 */

import type { Song, SectionNode, ChorusReference } from '../model/types.js';

/**
 * Resolve a `{chorus}` reference to the chorus section it refers to.
 *
 * Implements the ChordPro spec rule: return the last `start_of_chorus`
 * section (with a matching label, or any chorus when no label is given)
 * that appears **before** `ref` in document order among top-level lines.
 *
 * Returns `null` if no matching chorus precedes the reference.
 */
export function resolveChorus(song: Song, ref: ChorusReference): SectionNode | null {
  let last: SectionNode | null = null;

  for (const line of song.lines) {
    if (line === ref) break; // stop at the reference itself

    if (line.type === 'section' && line.kind === 'chorus') {
      if (ref.label === undefined || line.label === ref.label) {
        last = line;
      }
    }
  }

  return last;
}

/**
 * Collect all chorus sections that appear before the given reference,
 * in document order. Useful when the caller needs to choose among
 * multiple candidates rather than just the last one.
 */
export function collectChorusCandidates(song: Song, ref: ChorusReference): SectionNode[] {
  const result: SectionNode[] = [];

  for (const line of song.lines) {
    if (line === ref) break;

    if (line.type === 'section' && line.kind === 'chorus') {
      if (ref.label === undefined || line.label === ref.label) {
        result.push(line);
      }
    }
  }

  return result;
}
