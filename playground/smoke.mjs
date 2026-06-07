/**
 * Smoke test: verify the playground can import and call all public API functions.
 * Guards against the playground drifting from the library's public API.
 * Run with: node smoke.mjs  (from the playground/ directory)
 */

import {
  parse,
  serialize,
  parseChord,
  transpose,
  transposeChord,
  tokenize,
  renderText,
  renderHtml,
  parseFreeText,
  guessKey,
  getChordShape,
  toNashville,
  fromNashville,
  ALL_EXTENSIONS,
  DIRECTIVE_ALIASES,
  KNOWN_DIRECTIVES,
} from '../dist/index.js';

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error('returned false');
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
    failed++;
  }
}

console.log('\nchordpro-core public API smoke test\n');

const src = '{title: Test}\n{key: Am}\n[Am]word [G]two\n{start_of_chorus}\n[C]sing\n{end_of_chorus}';

check('parse() returns Song', () => {
  const s = parse(src);
  return s && Array.isArray(s.lines) && s.metadata instanceof Map;
});

check('parse() metadata extracted', () => {
  const s = parse(src);
  return s.metadata.get('title') === 'Test' && s.metadata.get('key') === 'Am';
});

check('serialize(parse(x)) is a string', () => {
  const out = serialize(parse(src));
  return typeof out === 'string' && out.length > 0;
});

check('serialize round-trip preserves title', () => {
  const out = serialize(parse(src));
  return out.includes('{title: Test}');
});

check('parseChord strict', () => {
  const c = parseChord('Am7b5');
  return c.parsed && c.root === 'A' && c.qualifier === 'm' && c.extension === '7b5';
});

check('parseChord relaxed', () => {
  const c = parseChord('Coda', { mode: 'relaxed' });
  return c.parsed && c.root === 'C';
});

check('parseChord returns parsed:false on failure', () => {
  const c = parseChord('Xyz123');
  return c.parsed === false && c.name === 'Xyz123';
});

check('parseChord never throws', () => {
  parseChord('');
  parseChord('!@#$%');
  parseChord('A'.repeat(1000));
  return true;
});

check('transposeChord Am7 +2 = Bm7', () => {
  const c = transposeChord(parseChord('Am7'), 2);
  return c.name === 'Bm7';
});

check('transpose(song) transposes key metadata qualifier', () => {
  const s = transpose(parse(src), 2);
  return s.metadata.get('key') === 'Bm';
});

check('transpose does not mutate original', () => {
  const s = parse(src);
  transpose(s, 5);
  return s.metadata.get('key') === 'Am';
});

check('tokenize returns Token[]', () => {
  const tokens = tokenize(src);
  return Array.isArray(tokens) && tokens.length > 0;
});

check('tokenize tiles source exactly', () => {
  const tokens = tokenize(src);
  return tokens.map((t) => t.text).join('') === src;
});

check('renderText returns string', () => {
  const out = renderText(parse(src));
  return typeof out === 'string' && out.includes('Test');
});

check('renderHtml returns string with cp- classes', () => {
  const out = renderHtml(parse(src));
  return out.includes('cp-song') && out.includes('cp-title');
});

check('parseFreeText returns ParseFreeTextResult', () => {
  const r = parseFreeText('My Song\nMy Artist\nKey: G\n\nVerse\n[G]hello');
  return typeof r.chordpro === 'string' && r.metadata instanceof Map && Array.isArray(r.warnings);
});

check('parseFreeText extracts title', () => {
  const r = parseFreeText('My Song\nMy Artist\n\nSome lyrics here');
  return r.metadata.get('title') === 'My Song';
});

check('guessKey returns result for chord-heavy song', () => {
  const r = guessKey('[G]one [G]two [D]three [G]four');
  return r !== null && typeof r.key === 'string' && r.confidence > 0;
});

check('guessKey returns null for no chords', () => {
  return guessKey('just some text') === null;
});

check('getChordShape guitar C', () => {
  const s = getChordShape('C', 'guitar');
  return s !== null && Array.isArray(s.frets) && s.frets.length === 6;
});

check('getChordShape ukulele G', () => {
  const s = getChordShape('G', 'ukulele');
  return s !== null && Array.isArray(s.frets) && s.frets.length === 4;
});

check('getChordShape returns null for unknown', () => {
  return getChordShape('Xyz999', 'guitar') === null;
});

check('toNashville returns Song', () => {
  const s = toNashville(parse(src), 'Am');
  return s && Array.isArray(s.lines);
});

check('fromNashville returns Song', () => {
  const s = fromNashville(parse(src), 'Am');
  return s && Array.isArray(s.lines);
});

check('DIRECTIVE_ALIASES is a non-empty record', () => {
  return typeof DIRECTIVE_ALIASES === 'object' && Object.keys(DIRECTIVE_ALIASES).length > 10;
});

check('KNOWN_DIRECTIVES is a non-empty array', () => {
  return Array.isArray(KNOWN_DIRECTIVES) && KNOWN_DIRECTIVES.length > 20;
});

check('KNOWN_DIRECTIVES entries have required fields', () => {
  return KNOWN_DIRECTIVES.every(
    (d) => typeof d.name === 'string' && typeof d.takesArg === 'boolean' && Array.isArray(d.aliases),
  );
});

check('ALL_EXTENSIONS is a non-empty array', () => {
  return Array.isArray(ALL_EXTENSIONS) && ALL_EXTENSIONS.length > 100;
});

check('parse never throws on garbage', () => {
  parse('');
  parse('{{{');
  parse('\x00\x01binary\xff');
  parse('{unclosed');
  parse(']]]');
  return true;
});

console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
