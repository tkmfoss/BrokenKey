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
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
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


function type(app, value, inputType = 'insertText', data = null) {
  const input = app.elements.get('typing-input');
  input.value = value;
  input.selectionStart = input.selectionEnd = value.length;
  const event = new Event('input');
  Object.defineProperties(event, { inputType: { value: inputType }, data: { value: data } });
  input.dispatchEvent(event);
}
const options = (text, completed, onInput) => ({
  tokenKinds: Array(text.length).fill('keyword'), indent: '    ',
  onComplete: metrics => completed.push(metrics), onInput
});
test('code session reuses real typing engine, rejects bulk/paste and requires exact completion', () => {
  const app = loadTypingEngine(), done = [], changes = [];
  const api = app.window.BrokenKeyTyping, source = 'if x:';
  assert.equal(api.startCodeSession(source, options(source, done, (...args) => changes.push(args))), true);
  assert.match(app.elements.get('passage').innerHTML, /token-keyword/);
  type(app, source, 'insertFromPaste');
  assert.equal(app.elements.get('typing-input').value, '');
  type(app, source);
  assert.equal(app.elements.get('typing-input').value, '');
  for (const value of ['x', 'xf', 'xf ', 'xf x', 'xf x:']) type(app, value);
  assert.equal(done.length, 0);
  type(app, source);
  assert.equal(done.length, 1);
  assert.equal(done[0].accuracy, 100);
  assert.equal(app.storage.has('keyrush-best-wpm'), false);
  assert.equal(app.storage.has('keyrush-best-accuracy'), false);
  assert.equal(changes.length, 6);
  assert.equal(api.cancelCodeSession(), true);
});
test('code indentation is explicit, constrained and included in accepted attempts', () => {
  const app = loadTypingEngine(), done = [], edits = [];
  const api = app.window.BrokenKeyTyping, source = '    x';
  api.startCodeSession(source, options(source, done, (...args) => edits.push(args)));
  const input = app.elements.get('typing-input');
  input.selectionStart = input.selectionEnd = 0;
  assert.equal(api.insertCodeIndent(), true);
  assert.equal(input.value, '    ');
  assert.deepEqual(edits[0], ['', '    ', {start: 0, end: 0}]);
  type(app, source);
  assert.equal(done.length, 1);
  assert.equal(api.insertCodeIndent(), false);
});
test('code cancellation resets hooks and leaves Learn Mode behavior intact', () => {
  const app = loadTypingEngine(), done = [], learn = [];
  const api = app.window.BrokenKeyTyping;
  api.startCodeSession('abc', options('abc', done));
  type(app, 'a');
  assert.equal(api.cancelCodeSession(), true);
  assert.equal(done.length, 0);
  assert.equal(api.startLearningSession('lesson', value => learn.push(value)), true);
  assert.doesNotMatch(app.elements.get('passage').innerHTML, /token-keyword/);
  type(app, 'lesson');
  assert.equal(learn.length, 1);
  assert.equal(app.elements.get('status-label').textContent, 'LEARNING PASSAGE COMPLETE');
});

test('completion during indentation can safely cancel the shared session', () => {
  const app = loadTypingEngine(), done = [], api = app.window.BrokenKeyTyping;
  const source = 'x\n    ';
  api.startCodeSession(source, {
    ...options(source, done),
    onComplete(metrics) { done.push(metrics); api.cancelCodeSession(); }
  });
  type(app, 'x');
  type(app, 'x\n');
  assert.equal(api.insertCodeIndent(), true);
  assert.equal(done.length, 1);
  assert.equal(api.cancelCodeSession(), false);
});
test('drop and paste events are prevented only in code practice', () => {
  const app = loadTypingEngine(), api = app.window.BrokenKeyTyping;
  api.startCodeSession('abc', options('abc', []));
  const input = app.elements.get('typing-input');
  for (const kind of ['drop', 'paste']) {
    const event = new Event(kind, {cancelable: true});
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  api.cancelCodeSession();
  const drop = new Event('drop', {cancelable: true});
  input.dispatchEvent(drop);
  assert.equal(drop.defaultPrevented, false);
});

function pressTab(app, modifiers = {}) {
  const event = new Event('keydown', { cancelable: true });
  for (const [name, value] of Object.entries({ key: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...modifiers })) {
    Object.defineProperty(event, name, { value });
  }
  app.elements.get('typing-input').dispatchEvent(event);
  return event.defaultPrevented;
}
test('Tab inserts the selected indentation unit and advances the caret without losing focus', () => {
  for (const indent of ['  ', '    ', '\t']) {
    const app = loadTypingEngine(), done = [], edits = [];
    const api = app.window.BrokenKeyTyping, source = 'x\n' + indent + indent + 'y';
    api.startCodeSession(source, { ...options(source, done, (...args) => edits.push(args)), indent });
    type(app, 'x');
    type(app, 'x\n');
    assert.equal(pressTab(app), true);
    assert.equal(pressTab(app), true);
    const input = app.elements.get('typing-input');
    assert.equal(input.value, 'x\n' + indent + indent);
    assert.equal(input.selectionStart, input.value.length);
    assert.equal(edits.at(-1)[1], input.value);
    type(app, source);
    assert.equal(done.length, 1);
    api.cancelCodeSession();
  }
});
test('Shift+Tab, modified Tab, and Tab outside leading whitespace retain browser navigation', () => {
  const app = loadTypingEngine(), api = app.window.BrokenKeyTyping;
  api.startCodeSession('x\n    y', options('x\n    y', []));
  type(app, 'x');
  assert.equal(pressTab(app), false);
  type(app, 'x\n');
  assert.equal(pressTab(app, { shiftKey: true }), false);
  assert.equal(pressTab(app, { ctrlKey: true }), false);
  assert.equal(pressTab(app, { altKey: true }), false);
  assert.equal(pressTab(app, { metaKey: true }), false);
  assert.equal(app.elements.get('typing-input').value, 'x\n');
  api.cancelCodeSession();
  api.startLearningSession('lesson', () => {});
  assert.equal(pressTab(app), false);
  api.cancelLearningSession();
  assert.equal(pressTab(app), false);
});
