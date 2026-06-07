/**
 * Nashville Number System conversion — Tier 2 auxiliary helper.
 * Converts chord roots to/from scale degrees relative to a key.
 *
 * @remarks
 * Auxiliary helper, not part of the ChordPro format specification.
 * v1 stub: typed signatures with placeholder behavior.
 * Full implementation planned for a future version.
 */

import type { Song } from '../model/types.js';

/**
 * Convert all chords in a song to Nashville numbers relative to the given key.
 * @remarks Tier-2 stub — not yet fully implemented.
 */
export function toNashville(song: Song, _key: string): Song {
  // TODO: implement Nashville conversion
  return song;
}

/**
 * Convert Nashville number chords in a song back to named chords relative to the given key.
 * @remarks Tier-2 stub — not yet fully implemented.
 */
export function fromNashville(song: Song, _key: string): Song {
  // TODO: implement Nashville conversion
  return song;
}
