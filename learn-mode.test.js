import test from 'node:test';
import assert from 'node:assert/strict';
import { LEARN_CATEGORIES, LEARN_LESSONS } from './learn-content.js';
import {
  LEARN_PROGRESS_KEY,
  completeLesson,
  createInitialProgress,
  getProgressSummary,
  loadProgress,
  normalizeProgress,
  parseProgress,
  recordLessonAccuracy,
  saveProgress,
  setLastAccessed
} from './learn-progress.js';

const lessonIds = LEARN_LESSONS.map((lesson) => lesson.id);

function createMemoryStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(LEARN_PROGRESS_KEY, initial);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values
  };
}

test('initial content contains exactly six uniquely identified lessons in all categories', () => {
  assert.equal(LEARN_LESSONS.length, 6);
  assert.equal(new Set(lessonIds).size, lessonIds.length);
  assert.deepEqual(new Set(LEARN_LESSONS.map((lesson) => lesson.categoryId)), new Set(LEARN_CATEGORIES.map((category) => category.id)));
  for (const lesson of LEARN_LESSONS) {
    assert.ok(['Beginner', 'Intermediate'].includes(lesson.difficulty));
    assert.ok(lesson.title && lesson.learningObjective && lesson.explanation && lesson.practicalExample);
    assert.ok(lesson.typingPassage && lesson.recallQuestion && lesson.expectedAnswer);
    assert.ok(Array.isArray(lesson.references) && lesson.references.length > 0);
    assert.ok(lesson.references.every((reference) => reference.label && /^https:\/\//.test(reference.url)));
  }
});

test('all lesson typing passages are meaningful and within the agreed 50–120 word range', () => {
  for (const lesson of LEARN_LESSONS) {
    const words = lesson.typingPassage.trim().split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 50 && words <= 120, `${lesson.id} has ${words} words`);
  }
});

test('category filters have at least one lesson each', () => {
  for (const category of LEARN_CATEGORIES) {
    assert.ok(LEARN_LESSONS.some((lesson) => lesson.categoryId === category.id), `${category.id} has no lesson`);
  }
});

test('missing, malformed, unsupported-version, and invalid progress recover safely', () => {
  assert.deepEqual(parseProgress(null, lessonIds), createInitialProgress());
  assert.deepEqual(parseProgress('{broken', lessonIds), createInitialProgress());
  assert.deepEqual(parseProgress(JSON.stringify({ version: 99 }), lessonIds), createInitialProgress());
  assert.deepEqual(normalizeProgress(null, lessonIds), createInitialProgress());
  assert.deepEqual(loadProgress({ getItem() { throw new Error('blocked'); } }, lessonIds), createInitialProgress());
});

test('normalization drops unknown IDs and duplicate completions and bounds accuracy', () => {
  const normalized = normalizeProgress({
    version: 1,
    completedLessonIds: ['dbms-basics', 'dbms-basics', 'unknown-id', 42],
    lastAccessedLessonId: 'unknown-id',
    bestAccuracyByLesson: { 'dbms-basics': 140, 'sql-vs-nosql': -9, 'unknown-id': 77, 'what-is-api': 'bad' }
  }, lessonIds);
  assert.deepEqual(normalized.completedLessonIds, ['dbms-basics']);
  assert.equal(normalized.lastAccessedLessonId, null);
  assert.deepEqual(normalized.bestAccuracyByLesson, { 'dbms-basics': 100, 'sql-vs-nosql': 0 });
});

test('lesson completion is idempotent and summary reflects the six lessons', () => {
  let progress = createInitialProgress();
  progress = completeLesson(progress, 'dbms-basics', lessonIds);
  progress = completeLesson(progress, 'dbms-basics', lessonIds);
  progress = completeLesson(progress, 'unknown-id', lessonIds);
  assert.deepEqual(progress.completedLessonIds, ['dbms-basics']);
  assert.deepEqual(getProgressSummary(progress, lessonIds), { total: 6, completed: 1, remaining: 5, percentage: 17 });
});

test('best accuracy is retained per lesson and never decreases', () => {
  let progress = createInitialProgress();
  progress = recordLessonAccuracy(progress, 'dbms-basics', 87, lessonIds);
  progress = recordLessonAccuracy(progress, 'dbms-basics', 82, lessonIds);
  progress = recordLessonAccuracy(progress, 'sql-vs-nosql', 76, lessonIds);
  progress = recordLessonAccuracy(progress, 'what-is-api', 145, lessonIds);
  assert.equal(progress.bestAccuracyByLesson['dbms-basics'], 87);
  assert.equal(progress.bestAccuracyByLesson['sql-vs-nosql'], 76);
  assert.equal(progress.bestAccuracyByLesson['what-is-api'], 100);
});

test('last accessed lesson and persisted progress survive reload', () => {
  const storage = createMemoryStorage();
  let progress = setLastAccessed(createInitialProgress(), 'mcp-introduction', lessonIds);
  progress = completeLesson(progress, 'mcp-introduction', lessonIds);
  assert.equal(saveProgress(storage, progress), true);
  assert.deepEqual(loadProgress(storage, lessonIds), progress);
});

test('storage write failures do not crash the lesson workflow', () => {
  assert.equal(saveProgress({ setItem() { throw new Error('quota'); } }, createInitialProgress()), false);
  assert.equal(saveProgress(null, createInitialProgress()), false);
});

// Exercise the real browser-facing adapter in script.js with a lightweight DOM.
import fs from 'node:fs';

class MockElement extends EventTarget {
  constructor(id = '') {
    super();
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.dataset = {};
    this.disabled = false;
    this.maxLength = -1;
    this.selectionStart = 0;
    this.style = {};
    this.attributes = {};
    this._classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this._classes.add(name)),
      remove: (...names) => names.forEach((name) => this._classes.delete(name)),
      contains: (name) => this._classes.has(name),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !this._classes.has(name) : Boolean(force);
        if (shouldAdd) this._classes.add(name);
        else this._classes.delete(name);
        return shouldAdd;
      }
    };
  }
  querySelector() { return new MockElement(); }
  querySelectorAll() { return []; }
  getContext() { return null; }
  focus() {}
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  scrollIntoView() {}
}

function loadTypingEngine() {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new MockElement(id));
    return elements.get(id);
  };
  const documentMock = {
    getElementById,
    querySelectorAll: () => [],
    body: new MockElement('body')
  };
  const values = new Map();
  const storageMock = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
  const windowMock = {
    location: { href: '' },
    addEventListener() {},
    removeEventListener() {}
  };
  const scriptPath = new URL('./script.js', import.meta.url);
  if (!fs.existsSync(scriptPath)) return null;
  const scriptCode = fs.readFileSync(scriptPath, 'utf8');
  const moduleMock = { exports: {} };
  const execute = new Function('document', 'window', 'localStorage', 'KeyboardEvent', 'Event', 'module', 'exports', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', scriptCode);
  execute(documentMock, windowMock, storageMock, function MockKeyboardEvent() {}, Event, moduleMock, moduleMock.exports, setInterval, clearInterval, setTimeout, clearTimeout, () => 1, () => {});
  return { elements, window: windowMock, storage: values, engine: moduleMock.exports };
}

const hasTypingEngineScript = fs.existsSync(new URL('./script.js', import.meta.url));
test('real typing engine exposes untimed Learn Mode without writing regular personal bests', { skip: !hasTypingEngineScript }, () => {
  const app = loadTypingEngine();
  const metrics = [];
  const passage = 'Learn mode shares the typing engine.';
  assert.equal(typeof app.window.BrokenKeyTyping?.startLearningSession, 'function');
  assert.equal(app.window.BrokenKeyTyping.startLearningSession(passage, (value) => metrics.push(value)), true);

  const input = app.elements.get('typing-input');
  assert.equal(input.disabled, false);
  assert.equal(app.elements.get('time').textContent, 'UNTIMED');
  input.value = passage;
  input.selectionStart = passage.length;
  input.dispatchEvent(new Event('input'));

  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].accuracy, 100);
  assert.ok(metrics[0].wpm >= 0);
  assert.equal(app.storage.has('keyrush-best-wpm'), false);
  assert.equal(app.storage.has('keyrush-best-accuracy'), false);
  assert.equal(app.elements.get('status-label').textContent, 'LEARNING PASSAGE COMPLETE');

  assert.equal(app.window.BrokenKeyTyping.cancelLearningSession(), true);
});
