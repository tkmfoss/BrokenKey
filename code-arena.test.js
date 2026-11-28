import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, KINDS, tokenize, createAttemptTracker, getInsertion, emptyCounts, weakestConstructs, selectExercise, formatIndentation } from './code-arena-core.js';
import { EXERCISES } from './code-arena-content.js';
import { STORAGE_KEY, MAX_SESSIONS, appendSession, loadHistory, saveHistory } from './code-arena-storage.js';

test('all four languages have unique exercises across three difficulty tiers', () => {
  assert.equal(new Set(EXERCISES.map(e => e.id)).size, EXERCISES.length);
  for (const lang of LANGUAGES) {
    assert.deepEqual([...new Set(EXERCISES.filter(e => e.language === lang).map(e => e.tier))], [1, 2, 3]);
  }
});
test('tokenization is lossless with exact offsets for every exercise', () => {
  for (const e of EXERCISES) {
    const tokens = tokenize(e.source, e.language);
    assert.equal(tokens.map(t => t.value).join(''), e.source);
    for (const t of tokens) {
      assert.equal(e.source.slice(t.start, t.end), t.value);
      assert.ok(KINDS.includes(t.kind));
    }
  }
});
test('language-specific keywords and comments', () => {
  for (const [lang, source, keyword] of [
    ['python', 'def f(): # comment\n    return "a#b"', 'def'],
    ['javascript', 'const a = "//"; // comment', 'const'],
    ['c', 'int x = 0; /* comment */', 'int'],
    ['cpp', 'template <typename T> // comment', 'template']
  ]) {
    const tokens = tokenize(source, lang);
    assert.ok(tokens.some(t => t.value === keyword && t.kind === 'keyword'));
    assert.ok(tokens.some(t => t.kind === 'comment'));
  }
  assert.equal(tokenize('template', 'c')[0].kind, 'identifier');
  assert.equal(tokenize('template', 'cpp')[0].kind, 'keyword');
  assert.equal(tokenize('    x', 'python')[0].kind, 'indentation');
  assert.equal(tokenize('x // 2', 'python')[2].kind, 'operator');
});
test('comments and strings are not recursively classified as keywords', () => {
  assert.equal(tokenize('"""return\nif"""', 'python').length, 1);
  assert.equal(tokenize('"return // x"', 'javascript')[0].kind, 'string');
  assert.equal(tokenize('/* return */', 'cpp')[0].kind, 'comment');
  assert.throws(() => tokenize('x', 'ruby'), TypeError);
});
test('construct errors are attributed to expected positions, including corrected attempts', () => {
  const tracker = createAttemptTracker('if x:\n    pass', 'python');
  tracker.record(0, 'x');
  tracker.record(0, 'i');
  tracker.record(6, 'x');
  tracker.record(6, ' ');
  const counts = tracker.snapshot();
  assert.deepEqual(counts.keyword, { attempts: 2, errors: 1 });
  assert.deepEqual(counts.indentation, { attempts: 2, errors: 1 });
  counts.keyword.errors = 99;
  assert.equal(tracker.snapshot().keyword.errors, 1);
});
test('insertion handles append, deletion, replacement and identical repeated keys', () => {
  assert.deepEqual(getInsertion('ab', 'abc'), { start: 2, inserted: 'c' });
  assert.deepEqual(getInsertion('abc', 'ac'), { start: 1, inserted: '' });
  assert.deepEqual(getInsertion('abc', 'axc', { start: 1, end: 2 }), { start: 1, inserted: 'x' });
  assert.deepEqual(getInsertion('aaa', 'aaaa', { start: 1, end: 1 }), { start: 1, inserted: 'a' });
});
const session = (id, language = 'python', errors = 0, wpm = 35, exerciseId = 'py-1a') => {
  const counts = emptyCounts();
  counts.keyword = { attempts: 40, errors };
  return { id, language, exerciseId, completedAt: 1, wpm, accuracy: 100, counts };
};
test('weakness ranking pools attempts, isolates languages and ignores low samples', () => {
  const a = session('a', 'python', 20);
  a.counts.operator = { attempts: 1, errors: 1 };
  const weak = weakestConstructs([a, session('b', 'javascript', 40)], 'python');
  assert.deepEqual(weak.map(w => [w.kind, w.rate]), [['keyword', .5]]);
});
test('adaptive selection is deterministic and progresses or reduces difficulty', () => {
  const initial = selectExercise(EXERCISES, [], 'python');
  assert.equal(initial.tier, 1);
  const high = [session('a'), session('b')];
  assert.equal(selectExercise(EXERCISES, high, 'python').tier, 2);
  const low = [session('c', 'python', 20, 35, 'py-2'), session('d', 'python', 20, 35, 'py-2')];
  assert.equal(selectExercise(EXERCISES, low, 'python').tier, 1);
  assert.equal(selectExercise(EXERCISES, high, 'python').id, selectExercise(EXERCISES, high, 'python').id);
  assert.equal(selectExercise(EXERCISES, high, 'cpp').tier, 1);
});
test('history round trips, rejects duplicate IDs, bounds history and isolates the key', () => {
  const map = new Map([['keyrush-best-wpm', '90']]);
  const storage = { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) };
  let history = [];
  for (let i = 0; i < MAX_SESSIONS + 2; i++) history = appendSession(history, session(String(i)));
  assert.equal(history.length, MAX_SESSIONS);
  assert.equal(history[0].id, '2');
  assert.equal(appendSession(history, history[0]), history);
  assert.equal(saveHistory(storage, history), true);
  assert.deepEqual(loadHistory(storage), history);
  assert.equal(map.get('keyrush-best-wpm'), '90');
  map.set(STORAGE_KEY, '{"version":99,"sessions":[]}');
  assert.deepEqual(loadHistory(storage), []);
  map.set(STORAGE_KEY, '{bad');
  assert.deepEqual(loadHistory(storage), []);
});
test('storage corruption, invalid records and quota errors are safe', () => {
  const invalid = session('bad');
  invalid.counts.keyword.errors = 41;
  const storage = { getItem: () => JSON.stringify({ version: 1, sessions: [invalid, session('good')] }), setItem: () => { throw Error('quota'); } };
  assert.deepEqual(loadHistory(storage).map(s => s.id), ['good']);
  assert.equal(saveHistory(storage, [session('a')]), false);
  assert.deepEqual(loadHistory(null), []);
});

test('indent conversion preserves nested structure and non-leading spaces', () => {
  assert.equal(formatIndentation('if x:\n    if y:\n        print("a b")', 'python', '\t'), 'if x:\n\tif y:\n\t\tprint("a b")');
  assert.equal(formatIndentation('if (x) {\n  return x;\n}', 'javascript', '    '), 'if (x) {\n    return x;\n}');
});

test('weakness prioritizes matching construct drills within the selected tier', () => {
  const counts = emptyCounts();
  counts.string = { attempts: 20, errors: 5 };
  const previous = { id: 'weak', language: 'python', exerciseId: 'py-1a', completedAt: 1, wpm: 20, accuracy: 75, counts };
  assert.equal(selectExercise(EXERCISES, [previous], 'python').id, 'py-1b');
});
test('curated snippets classify structural constructs and highlight literal markup safely', () => {
  const tokens = tokenize('if (x <= 2) {\n  return "<tag>";\n}', 'javascript');
  for (const [kind, value] of [['keyword','if'],['operator','<='],['bracket','{'],['punctuation',';'],['string','"<tag>"'],['indentation','  ']]) {
    assert.ok(tokens.some(t => t.kind === kind && t.value === value), kind);
  }
});
