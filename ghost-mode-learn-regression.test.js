import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BEST_WPM_KEY = 'keyrush-best-wpm';
const BEST_ACCURACY_KEY = 'keyrush-best-accuracy';

class MockElement extends EventTarget {
  constructor(id = '') {
    super();
    this.id = id;
    this.value = '';
    this.textContent = '';
    this._innerHTML = '';
    this.disabled = false;
    this.hidden = false;
    this.maxLength = -1;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this._classNames = new Set();

    this.classList = {
      add: (...names) => names.forEach((name) => this._classNames.add(name)),
      remove: (...names) => names.forEach((name) => this._classNames.delete(name)),
      contains: (name) => this._classNames.has(name),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !this._classNames.has(name) : Boolean(force);
        if (shouldAdd) this._classNames.add(name);
        else this._classNames.delete(name);
        return shouldAdd;
      }
    };
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (value === '') this.children = [];
  }

  get className() {
    return [...this._classNames].join(' ');
  }

  set className(value) {
    this._classNames = new Set(String(value).split(/\\s+/).filter(Boolean));
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  insertAdjacentElement(_position, element) {
    this.adjacentElement = element;
    return element;
  }

  querySelector(selector) {
    if (selector === '.char') return this.children.find((child) => child.classList.contains('char')) || null;
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '.char') return this.children.filter((child) => child.classList.contains('char'));
    return [];
  }

  focus() {}
  scrollIntoView() {}
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) { return this.attributes[name] ?? null; }
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function executeTypingEngine(storage) {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new MockElement(id));
    return elements.get(id);
  };
  const document = {
    body: new MockElement('body'),
    getElementById,
    querySelectorAll: () => []
  };
  const window = {
    location: { href: '' },
    addEventListener() {},
    removeEventListener() {}
  };

  const source = fs.readFileSync(new URL('./script.js', import.meta.url), 'utf8');
  const moduleMock = { exports: {} };
  const execute = new Function(
    'document', 'window', 'localStorage', 'KeyboardEvent', 'Event',
    'module', 'exports', 'setInterval', 'clearInterval', 'setTimeout',
    'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame',
    source
  );

  execute(
    document,
    window,
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

  return { elements, window, engine: moduleMock.exports };
}

function executeGhostMode(storage) {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new MockElement(id));
    return elements.get(id);
  };
  const document = new EventTarget();
  document.body = new MockElement('body');
  document.getElementById = getElementById;
  document.createElement = (tag) => new MockElement(tag);
  document.querySelectorAll = () => [];

  const activeIntervals = new Set();
  let nextIntervalId = 1;
  const setIntervalMock = () => {
    const id = nextIntervalId++;
    activeIntervals.add(id);
    return id;
  };
  const clearIntervalMock = (id) => activeIntervals.delete(id);
  const window = {
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    location: { href: '' }
  };

  // Ghost Mode reads the same browser storage after navigation to ghost.html.
  elements.get('difficulty') || getElementById('difficulty');
  getElementById('difficulty').value = 'personal-best';

  const source = fs.readFileSync(new URL('./ghost.js', import.meta.url), 'utf8');
  const execute = new Function(
    'document', 'window', 'localStorage', 'setInterval', 'clearInterval',
    'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame',
    source
  );
  execute(
    document,
    window,
    storage,
    setIntervalMock,
    clearIntervalMock,
    setTimeout,
    clearTimeout,
    (callback) => setTimeout(() => callback(Date.now()), 0),
    () => {}
  );

  return { elements, activeIntervals };
}

async function verifyGhostAfterLearnMode(outcome) {
  const storage = createStorage({
    [BEST_WPM_KEY]: '88',
    [BEST_ACCURACY_KEY]: '97'
  });
  const app = executeTypingEngine(storage);
  const passage = 'Learn Mode progress must not overwrite the existing personal best.';

  let completionCalls = 0;
  assert.equal(
    app.window.BrokenKeyTyping.startLearningSession(passage, () => { completionCalls += 1; }),
    true,
    'Learn Mode should start before navigating to Ghost Mode'
  );

  const typingInput = app.elements.get('typing-input');

  if (outcome === 'completed') {
    typingInput.value = passage;
    typingInput.selectionStart = passage.length;
    typingInput.dispatchEvent(new Event('input'));
    assert.equal(completionCalls, 1, 'completed learning session should invoke completion once');
    assert.equal(app.engine.getTestState().testState, 'COMPLETED');
  } else {
    typingInput.value = passage.slice(0, 18);
    typingInput.selectionStart = typingInput.value.length;
    typingInput.dispatchEvent(new Event('input'));
    assert.equal(app.engine.getTestState().testState, 'RUNNING');
    assert.equal(app.window.BrokenKeyTyping.cancelLearningSession(), true);
    assert.equal(completionCalls, 0, 'cancelled learning session must not complete the lesson');
    assert.equal(app.engine.getTestState().testState, 'READY');
  }

  // The Ghost Mode Personal Best option depends on these same persisted values.
  assert.equal(storage.getItem(BEST_WPM_KEY), '88');
  assert.equal(storage.getItem(BEST_ACCURACY_KEY), '97');

  const ghost = executeGhostMode(storage);
  const difficulty = ghost.elements.get('difficulty');
  const startButton = ghost.elements.get('start-ghost-btn');
  const resetButton = ghost.elements.get('reset-ghost-btn');
  const playerInput = ghost.elements.get('player-input');
  const timerContainer = ghost.elements.get('race-timer-container');

  assert.equal(difficulty.value, 'personal-best');
  assert.equal(startButton.disabled, false, 'Personal Best should remain available in Ghost Mode');

  startButton.dispatchEvent(new Event('click'));

  assert.equal(startButton.disabled, true, 'Ghost Mode should enter its active race state');
  assert.equal(difficulty.disabled, true, 'difficulty selection should lock during a race');
  assert.equal(playerInput.disabled, false, 'player input should be enabled during a race');
  assert.equal(timerContainer.hidden, false, 'Ghost Mode race timer should become visible');
  assert.equal(ghost.activeIntervals.size, 1, 'Ghost Mode should start its own race timer');

  resetButton.dispatchEvent(new Event('click'));

  assert.equal(ghost.activeIntervals.size, 0, 'reset should clean up the Ghost Mode timer');
  assert.equal(startButton.disabled, false, 'reset should make Ghost Mode available again');
  assert.equal(difficulty.disabled, false, 'reset should unlock difficulty selection');
  assert.equal(playerInput.disabled, true, 'reset should return player input to its idle state');
  assert.equal(timerContainer.hidden, true, 'reset should hide the race timer');

  // Allow the pending simulated keystroke delay to resolve after reset invalidates it.
  await new Promise((resolve) => setTimeout(resolve, 250));
}

test('Ghost Mode Personal Best race works after completing a Learn Mode session', async () => {
  await verifyGhostAfterLearnMode('completed');
});

test('Ghost Mode Personal Best race works after cancelling an active Learn Mode session', async () => {
  await verifyGhostAfterLearnMode('cancelled');
});
