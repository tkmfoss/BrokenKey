import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

class MockElement extends EventTarget {
  constructor(id = '') {
    super();
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.maxLength = -1;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.style = {};
    this.attributes = {};
    this.children = [];
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
  scrollIntoView() {}
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  setCustomValidity() {}
  reportValidity() {}
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
}

function createEngine(initialStorage = {}) {
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

  const values = new Map(Object.entries(initialStorage));
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
  const windowListeners = new Map();
  const windowMock = {
    location: { href: '' },
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(handler);
    },
    removeEventListener() {}
  };

  const scriptPath = new URL('./script.js', import.meta.url);
  const scriptCode = fs.readFileSync(scriptPath, 'utf8');
  const moduleMock = { exports: {} };
  const execute = new Function(
    'document', 'window', 'localStorage', 'KeyboardEvent', 'Event',
    'module', 'exports', 'setInterval', 'clearInterval', 'setTimeout',
    'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame',
    scriptCode
  );

  execute(
    documentMock,
    windowMock,
    storage,
    function MockKeyboardEvent() {},
    Event,
    moduleMock,
    moduleMock.exports,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    () => 1,
    () => {}
  );

  return { elements, window: windowMock, storage: values, engine: moduleMock.exports };
}

test('pagehide cancels an active Learn Mode session', async () => {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new MockElement(id));
    return elements.get(id);
  };
  const body = new MockElement('body');
  body.setAttribute('data-learn-app', '');
  const documentMock = {
    body,
    getElementById,
    createElement: (tag) => new MockElement(tag),
    querySelectorAll: () => []
  };

  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
  const listeners = new Map();
  const typing = {
    active: false,
    cancelCalls: 0,
    startLearningSession() {
      this.active = true;
      return true;
    },
    cancelLearningSession() {
      if (!this.active) return false;
      this.active = false;
      this.cancelCalls += 1;
      return true;
    }
  };
  const windowMock = {
    localStorage: storage,
    BrokenKeyTyping: typing,
    addEventListener(type, handler) { listeners.set(type, handler); },
    scrollTo() {}
  };

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = windowMock;
  globalThis.document = documentMock;

  try {
    await import('./learn-mode.js?pagehide-cleanup-regression');

    const lessonGrid = getElementById('learn-lessons-grid');
    assert.ok(lessonGrid.children.length > 0, 'lesson catalogue should render');

    lessonGrid.children[0].dispatchEvent(new Event('click'));
    getElementById('learn-start-typing').dispatchEvent(new Event('click'));

    assert.equal(typing.active, true, 'lesson should have an active typing session');
    assert.equal(typeof listeners.get('pagehide'), 'function', 'pagehide cleanup should be registered');

    listeners.get('pagehide')();

    assert.equal(typing.active, false, 'navigation should cancel the active typing session');
    assert.equal(typing.cancelCalls, 1, 'active session should be cancelled exactly once');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('cancelling an active learning session resets transient state and preserves Ghost Mode personal-best data', () => {
  const app = createEngine({
    'keyrush-best-wpm': '88',
    'keyrush-best-accuracy': '97'
  });
  const passage = 'Learn Mode must clean up safely when a learner leaves midway.';
  let completionCalls = 0;

  assert.equal(
    app.window.BrokenKeyTyping.startLearningSession(passage, () => { completionCalls += 1; }),
    true
  );

  const input = app.elements.get('typing-input');
  input.value = passage.slice(0, 12);
  input.selectionStart = input.value.length;
  input.dispatchEvent(new Event('input'));

  assert.equal(app.engine.getTestState().testState, 'RUNNING');
  assert.equal(app.engine.getTestState().isTyping, true);
  assert.equal(app.engine.getTimer(), null, 'Learn Mode must not create a countdown interval');
  assert.equal(app.engine.getSessionReplayEvents().length, 0, 'Learn Mode must not record replay events');

  assert.equal(app.window.BrokenKeyTyping.cancelLearningSession(), true);

  const state = app.engine.getTestState();
  assert.equal(state.testState, 'READY');
  assert.equal(state.isTyping, false);
  assert.equal(input.value, '');
  assert.equal(input.disabled, false);
  assert.equal(app.engine.getTimer(), null);
  assert.equal(completionCalls, 0, 'cancellation must not report a completed lesson');
  assert.equal(app.storage.get('keyrush-best-wpm'), '88');
  assert.equal(app.storage.get('keyrush-best-accuracy'), '97');
});

test('regular timed practice and Free Run still start after Learn Mode cleanup', () => {
  const app = createEngine();
  const engine = app.engine;
  const passage = 'The normal typing modes must remain independent.';

  app.window.BrokenKeyTyping.startLearningSession('An active learning session is cancelled before switching modes.', () => {});
  app.window.BrokenKeyTyping.cancelLearningSession();

  engine.setTimeLimit(30);
  engine.resetTest();
  engine.setTestPassage(passage);
  engine.startTest();

  assert.equal(engine.getTestState().testState, 'RUNNING');
  assert.ok(engine.getTimer(), 'timed practice should create its countdown interval');
  assert.equal(engine.getTimeLeft(), 30);
  assert.equal(app.elements.get('time-stat-label').textContent, 'Time left');
  assert.equal(engine.getSessionReplayEvents().length, 1, 'regular practice should initialize replay capture');

  engine.resetTest();
  engine.setTimeLimit(0);
  engine.resetTest();
  engine.setTestPassage(passage);
  engine.startTest();

  assert.equal(engine.getTestState().testState, 'RUNNING');
  assert.ok(engine.getTimer(), 'Free Run should create its count-up interval');
  assert.equal(engine.getTimeLeft(), 0);
  assert.equal(app.elements.get('time-stat-label').textContent, 'Time elapsed');
  assert.equal(engine.getSessionReplayEvents().length, 1, 'Free Run should initialize replay capture');

  engine.resetTest();
});

test('regular typing sessions continue recording replay events after Learn Mode', () => {
  const app = createEngine();
  const engine = app.engine;
  const passage = 'Replay capture must remain enabled for regular practice.';

  app.window.BrokenKeyTyping.startLearningSession('Finish this lesson before returning to practice.', () => {});
  app.window.BrokenKeyTyping.cancelLearningSession();

  engine.setTimeLimit(30);
  engine.resetTest();
  engine.setTestPassage(passage);
  engine.startTest();

  const input = app.elements.get('typing-input');
  input.value = 'Replay capture';
  input.selectionStart = input.value.length;
  input.dispatchEvent(new Event('input'));

  const eventsDuringTyping = engine.getSessionReplayEvents();
  const replayEventCountDuringTyping = eventsDuringTyping.length;
  assert.ok(replayEventCountDuringTyping > 1, 'regular typing should record changes');
  assert.equal(eventsDuringTyping.at(-1).val, 'Replay capture');

  engine.finishTest();

  const replayButton = app.elements.get('replay-btn');
  assert.ok(
    engine.getSessionReplayEvents().length > replayEventCountDuringTyping,
    'finishing a regular session should append a final replay event'
  );
  assert.equal(replayButton.classList.contains('hidden'), false, 'completed regular sessions should expose replay');

  engine.resetTest();
});
