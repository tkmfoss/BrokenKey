import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GhostAnalytics = require('./ghost-analytics.js');

function createStorage(seed = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)]));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    snapshot() {
      return Object.fromEntries(store.entries());
    }
  };
}

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
    this.style = {};
    this._classNames = new Set();
    this.classList = {
      add: (...names) => names.forEach((n) => this._classNames.add(n)),
      remove: (...names) => names.forEach((n) => this._classNames.delete(n)),
      contains: (n) => this._classNames.has(n),
      toggle: (n, force) => {
        const shouldAdd = force === undefined ? !this._classNames.has(n) : Boolean(force);
        if (shouldAdd) this._classNames.add(n);
        else this._classNames.delete(n);
        return shouldAdd;
      }
    };
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = String(val);
    if (val === '') this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  insertAdjacentElement() {}
  querySelector() { return this.children[0] || null; }
  querySelectorAll() { return this.children; }
  focus() {}
  scrollIntoView() {}
}

function loadGhostApp(storage) {
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

  const intervals = new Map();
  let nextIntervalId = 1;
  const setIntervalMock = (fn) => {
    const id = nextIntervalId++;
    intervals.set(id, fn);
    return id;
  };
  const clearIntervalMock = (id) => intervals.delete(id);

  const windowObj = {
    GhostAnalytics,
    matchMedia: () => ({ matches: true }),
    addEventListener() {},
    location: { href: '' }
  };

  getElementById('difficulty').value = 'beginner';

  const source = fs.readFileSync(new URL('./ghost.js', import.meta.url), 'utf8');
  const run = new Function(
    'document', 'window', 'localStorage', 'setInterval', 'clearInterval',
    'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame',
    source
  );
  run(
    document,
    windowObj,
    storage,
    setIntervalMock,
    clearIntervalMock,
    setTimeout,
    clearTimeout,
    (cb) => cb(Date.now()),
    () => {}
  );

  return { elements, intervals };
}

test('GhostAnalytics initializes cleanly from empty storage', () => {
  const storage = createStorage();
  const summary = GhostAnalytics.loadGhostAnalytics(storage);
  assert.equal(summary.bestWpm, 0);
  assert.equal(summary.averageWpm, 0);
  assert.equal(summary.bestAccuracy, 0);
  assert.equal(summary.totalRaces, 0);
  assert.deepEqual(summary.history, []);
});

test('GhostAnalytics isolates storage keys from Practice PB and aggregates accurately', () => {
  const storage = createStorage({
    'keyrush-best-wpm': '99',
    'keyrush-best-accuracy': '99.5'
  });

  const r1 = GhostAnalytics.recordGhostRace(storage, {
    wpm: 48,
    accuracy: 92.4,
    score: 80.5,
    difficulty: 'beginner',
    outcome: 'YOU WIN!'
  });
  assert.equal(r1.isNewBestWpm, true);
  assert.equal(r1.bestWpm, 48);
  assert.equal(r1.averageWpm, 48);
  assert.equal(r1.totalRaces, 1);

  const r2 = GhostAnalytics.recordGhostRace(storage, {
    wpm: 62,
    accuracy: 96.8,
    score: 91.2,
    difficulty: 'intermediate',
    outcome: 'YOU WIN!'
  });
  assert.equal(r2.isNewBestWpm, true);
  assert.equal(r2.bestWpm, 62);
  assert.equal(r2.bestAccuracy, 96.8);
  assert.equal(r2.averageWpm, 55);
  assert.equal(r2.totalRaces, 2);

  // Main Practice keys remain untouched
  assert.equal(storage.getItem('keyrush-best-wpm'), '99');
  assert.equal(storage.getItem('keyrush-best-accuracy'), '99.5');

  // Ghost keys persist across reload
  const reloaded = GhostAnalytics.loadGhostAnalytics(storage);
  assert.equal(reloaded.bestWpm, 62);
  assert.equal(reloaded.averageWpm, 55);
  assert.equal(reloaded.totalRaces, 2);

  // Clear resets Ghost analytics without affecting Practice PB
  const cleared = GhostAnalytics.clearGhostAnalytics(storage);
  assert.equal(cleared.totalRaces, 0);
  assert.equal(storage.getItem('keyrush-best-wpm'), '99');
});

test('GhostAnalytics recovers safely from corrupted storage and caps history', () => {
  const storage = createStorage({
    [GhostAnalytics.GHOST_BEST_WPM_KEY]: 'not-a-number',
    [GhostAnalytics.GHOST_HISTORY_KEY]: '{broken-json'
  });
  const initial = GhostAnalytics.loadGhostAnalytics(storage);
  assert.equal(initial.bestWpm, 0);
  assert.equal(initial.totalRaces, 0);

  for (let i = 1; i <= 25; i++) {
    GhostAnalytics.recordGhostRace(storage, {
      wpm: 30 + i,
      accuracy: 95,
      score: 85,
      difficulty: 'beginner',
      outcome: 'YOU WIN!'
    });
  }
  const capped = GhostAnalytics.loadGhostAnalytics(storage);
  assert.equal(capped.totalRaces, GhostAnalytics.MAX_HISTORY_ENTRIES);
  assert.equal(capped.bestWpm, 55);
});

test('Ghost Mode integration: records completed races once, ignores mid-race resets, and persists across new races', async () => {
  const storage = createStorage({
    'keyrush-best-wpm': '90',
    'keyrush-best-accuracy': '98'
  });
  const app = loadGhostApp(storage);

  const startBtn = app.elements.get('start-ghost-btn');
  const resetBtn = app.elements.get('reset-ghost-btn');
  const totalRacesEl = app.elements.get('ghost-stat-total-races');
  const bestWpmEl = app.elements.get('ghost-stat-best-wpm');

  assert.equal(totalRacesEl.textContent, '0');

  // Start Race 1 and reset mid-race without completing
  startBtn.dispatchEvent(new Event('click'));
  resetBtn.dispatchEvent(new Event('click'));
  assert.equal(totalRacesEl.textContent, '0', 'aborted race must not be counted');

  // Start Race 2 and let 30s timer expire naturally
  startBtn.dispatchEvent(new Event('click'));
  assert.equal(app.intervals.size, 1);
  const timerTick = [...app.intervals.values()][0];
  for (let s = 0; s < 30; s++) {
    timerTick();
  }
  // Extra call would mimic duplicate triggers; must stay 1
  timerTick();

  assert.equal(totalRacesEl.textContent, '1', 'completed race must be recorded exactly once');
  assert.equal(storage.getItem('keyrush-best-wpm'), '90', 'main PB key untouched');

  // Reset and finish another race via timer expiry
  resetBtn.dispatchEvent(new Event('click'));
  startBtn.dispatchEvent(new Event('click'));
  const timerTick2 = [...app.intervals.values()][0];
  for (let s = 0; s < 30; s++) {
    timerTick2();
  }

  assert.equal(totalRacesEl.textContent, '2');
  assert.ok(Number(bestWpmEl.textContent) >= 0);

  // Stop any pending ghost timeouts cleanly
  resetBtn.dispatchEvent(new Event('click'));
  await new Promise((r) => setTimeout(r, 250));
});
