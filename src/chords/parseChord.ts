/**
 * Chord parser — strict and relaxed modes.
 *
 * Decomposition: root [qualifier [extension]] [/bass]
 * Never throws; returns parsed:false on strict failure.
 */

import type { Chord } from '../model/types.js';
import { STRICT_EXTENSIONS, MINOR_EXTENSIONS } from './extensions.js';

export interface ChordParseOptions {
  /** 'strict' (default): extension must be in built-in table; 'relaxed': any trailing text. */
  mode?: 'strict' | 'relaxed';
}

// Note roots: standard A-G plus German H; also alternate spellings for flats.
// Ordered longest-first within each "family" so greedier matches take priority.
// Backtracking resolves ambiguities like Es vs E.
const NOTE_ROOTS = [
  // Alternate solfège spellings (longest first — checked before shorter roots)
  'Hes', // B-flat (German)
  'Bes', // B-flat (Dutch/Portuguese)
  'Cis', 'Des', 'Dis', 'Es', 'Fis', 'Ges', 'Gis', 'As', 'Ais',
  // Standard with accidentals (2-char before 1-char)
  'A#', 'Ab',
  'B#', 'Bb',
  'C#', 'Cb',
  'D#', 'Db',
  'E#', 'Eb',
  'F#', 'Fb',
  'G#', 'Gb',
  'H#', 'Hb',
  // Plain roots
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
];

/**
 * Parse a chord name into its components.
 * Uses backtracking: tries each root candidate (longest first) and returns
 * the first successful parse, allowing short plain roots to win over
 * solfège alternates when the solfège rest doesn't form a valid extension.
 * Returns parsed:false (and keeps original name) on strict failure.
 */
export function parseChord(name: string, options: ChordParseOptions = {}): Chord {
  const mode = options.mode ?? 'strict';

  if (!name) return { name, parsed: false };

  for (const candidate of NOTE_ROOTS) {
    if (!name.startsWith(candidate)) continue;
    const rest = name.slice(candidate.length);
    const result = tryWithRoot(name, candidate, rest, mode);
    if (result !== null) return result;
  }

  return { name, parsed: false };
}

/**
 * Try to parse a chord given a specific root + remaining string.
 * Returns a Chord on success, null to signal "try next root".
 */
function tryWithRoot(
  name: string,
  root: string,
  rest: string,
  mode: 'strict' | 'relaxed',
): Chord | null {
  // Split off bass note (after last `/`)
  const slashIdx = rest.lastIndexOf('/');
  let bassRaw = '';
  let beforeBass = rest;
  if (slashIdx !== -1) {
    bassRaw = rest.slice(slashIdx + 1);
    beforeBass = rest.slice(0, slashIdx);
  }

  // Validate bass note
  let bass: string | undefined;
  if (bassRaw) {
    let bassRoot: string | undefined;
    for (const candidate of NOTE_ROOTS) {
      if (bassRaw === candidate || bassRaw.startsWith(candidate)) {
        bassRoot = candidate;
        break;
      }
    }
    if (!bassRoot) {
      if (mode === 'strict') return null; // invalid bass in strict mode → try next root
      // Relaxed: treat slash+rest as part of qualifier/extension
      beforeBass = rest;
      bass = undefined;
    } else {
      bass = bassRaw;
    }
  }

  // Parse qualifier + extension from what's left before bass
  const qe = parseQualExt(beforeBass, mode);
  if (!qe.valid) return null; // try next root

  const chord: Chord = { name, root, parsed: true };
  if (qe.qualifier !== undefined) chord.qualifier = qe.qualifier;
  if (qe.extension !== undefined) chord.extension = qe.extension;
  if (bass !== undefined) chord.bass = bass;
  return chord;
}

// Minor qualifiers — longest first to prevent `m` consuming `min`/`mi`
const MINOR_QUALIFIERS = ['min', 'mi', 'm', '-'];
// These "other" qualifiers are really the full extension
const QUAL_OTHERS = ['aug', 'dim'];

interface QualExtResult {
  qualifier?: string;
  extension?: string;
  valid: boolean;
}

function parseQualExt(s: string, mode: 'strict' | 'relaxed'): QualExtResult {
  if (s === '') return { valid: true };

  // Handle maj/^ extensions BEFORE minor-qualifier matching to prevent
  // `m` from consuming the `m` in `maj7`.
  if (s.startsWith('maj') || s.startsWith('^')) {
    if (STRICT_EXTENSIONS.has(s)) return { extension: s, valid: true };
    if (mode === 'relaxed') return { extension: s, valid: true };
    return { valid: false };
  }

  // Try minor qualifiers (longest first)
  for (const q of MINOR_QUALIFIERS) {
    if (!s.startsWith(q)) continue;

    // When qualifier is 'm', ensure the next char isn't 'a' (which would be
    // part of 'maj') — already handled above, but guard defensively.
    const afterQ = s.slice(q.length);
    if (afterQ === '') return { qualifier: q, valid: true };

    if (mode === 'strict') {
      if (MINOR_EXTENSIONS.has(afterQ) || STRICT_EXTENSIONS.has(afterQ)) {
        return { qualifier: q, extension: afterQ, valid: true };
      }
      return { qualifier: q, valid: false };
    } else {
      return { qualifier: q, extension: afterQ, valid: true };
    }
  }

  // Try aug/dim (these combine root+qualifier into an extension name)
  for (const q of QUAL_OTHERS) {
    if (!s.startsWith(q)) continue;
    const afterQ = s.slice(q.length);
    if (afterQ === '') return { qualifier: q, valid: true };

    // dim7, dim5, aug5, etc. — check combined form first
    const combined = q + afterQ;
    if (STRICT_EXTENSIONS.has(combined)) return { extension: combined, valid: true };
    // aug or dim as a standalone qualifier
    if (mode === 'strict') return { qualifier: q, valid: false };
    return { qualifier: q, extension: afterQ, valid: true };
  }

  // No qualifier — try pure extension
  if (STRICT_EXTENSIONS.has(s)) return { extension: s, valid: true };
  if (mode === 'relaxed') return { extension: s, valid: true };

  return { valid: false };
}
