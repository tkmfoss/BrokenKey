import { tokenize, createAttemptTracker, getInsertion, formatIndentation, selectExercise, weakestConstructs, KINDS } from './code-arena-core.js';
import { EXERCISES } from './code-arena-content.js';
import { loadHistory, saveHistory, appendSession } from './code-arena-storage.js';
const $ = id => document.getElementById(id);
const api = window.BrokenKeyTyping;
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let history = loadHistory(storage), exercise = null, source = '', running = false;
let tracker = null;
const label = value => value[0].toUpperCase() + value.slice(1);
const indentUnit = () => $('arena-indent').value === 'tab' ? '\t' : ' '.repeat(Number($('arena-indent').value));
function setRunning(value) {
  running = value;
  $('arena-start').disabled = value;
  $('arena-cancel').disabled = !value;
  $('arena-indent-btn').disabled = !value;
  $('arena-language').disabled = value;
  $('arena-indent').disabled = value;
  $('typing-input').disabled = !value;
}
function preview() {
  exercise = selectExercise(EXERCISES, history, $('arena-language').value);
  source = formatIndentation(exercise.source, exercise.language, indentUnit());
  $('arena-exercise').textContent = exercise.title;
  $('arena-tier').textContent = 'Difficulty ' + exercise.tier + ' / 3';
  $('passage').textContent = source;
  $('typing-input').value = '';
  $('wpm').textContent = '0';
  $('accuracy').textContent = '100%';
  $('mistakes').textContent = '0';
}
function renderHistory() {
  const lang = $('arena-language').value;
  const sessions = history.filter(s => s.language === lang);
  const best = sessions.reduce((max, item) => Math.max(max, item.wpm), 0);
  const average = sessions.length ? Math.round(sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length) : 0;
  $('arena-history').replaceChildren();
  for (const [name, value] of [['Completed drills', sessions.length], ['Best WPM', best], ['Mean attempt accuracy', sessions.length ? average + '%' : '—']]) {
    const card = document.createElement('div'), title = document.createElement('span'), number = document.createElement('strong');
    title.textContent = name; number.textContent = value; card.append(title, number); $('arena-history').append(card);
  }
  const weak = weakestConstructs(history, lang);
  $('arena-weakness').textContent = weak.length ? 'Focus on the constructs below. Rates include corrected attempts.' : 'No measured construct weakness yet (at least five attempts per construct are needed).';
  $('arena-weak-list').replaceChildren();
  for (const item of weak) {
    const li = document.createElement('li');
    li.textContent = label(item.kind) + ': ' + Math.round(item.rate * 100) + '% error rate (' + item.errors + '/' + item.attempts + ')';
    $('arena-weak-list').append(li);
  }
  const last = sessions.at(-1);
  $('arena-latest').textContent = last ? last.wpm + ' WPM · ' + last.accuracy + '% attempt accuracy · ' + (EXERCISES.find(e => e.id === last.exerciseId)?.title || last.exerciseId) : 'No completed exercises yet.';
}
function cancel() {
  api.cancelCodeSession();
  tracker = null;
  setRunning(false);
  preview();
  $('arena-status').textContent = 'Exercise reset. Nothing was saved.';
}
function start() {
  if (running) return;
  tracker = createAttemptTracker(source, exercise.language);
  const tokenKinds = [];
  for (const token of tokenize(source, exercise.language)) for (let i = token.start; i < token.end; i++) tokenKinds[i] = token.kind;
  setRunning(true);
  const started = api.startCodeSession(source, {
    tokenKinds, indent: indentUnit(),
    onInput(previous, typed, selection) {
      const change = getInsertion(previous, typed, selection);
      if (change) tracker.record(change.start, change.inserted);
    },
    onComplete(metrics) {
      if (!running) return;
      const counts = tracker.snapshot();
      const attempts = KINDS.reduce((n,k) => n + counts[k].attempts, 0);
      const errors = KINDS.reduce((n,k) => n + counts[k].errors, 0);
      const accuracy = attempts ? Math.round(100 * (attempts - errors) / attempts) : 0;
      history = appendSession(history, {
        id: globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + String(history.length),
        language: exercise.language, exerciseId: exercise.id, completedAt: Date.now(),
        wpm: metrics.wpm, accuracy, counts
      });
      const saved = saveHistory(storage, history);
      $('arena-storage-status').textContent = saved ? 'Progress saved on this device.' : 'Storage unavailable; progress is retained for this page only.';
      tracker = null;
      setRunning(false);
      api.cancelCodeSession();
      preview();
      renderHistory();
      $('arena-status').textContent = 'Completed: ' + metrics.wpm + ' WPM · ' + accuracy + '% attempt accuracy. Next drill ready.';
    }
  });
  if (!started) { setRunning(false); tracker = null; $('arena-status').textContent = 'Unable to start exercise.'; return; }
  $('arena-status').textContent = 'Exercise in progress. Match every character.';
}
$('arena-start').addEventListener('click', start);
$('arena-cancel').addEventListener('click', cancel);
$('arena-indent-btn').addEventListener('click', () => {
  if (api.insertCodeIndent() && running) $('typing-input').focus();
});
$('arena-language').addEventListener('change', () => {
  $('arena-indent').value = $('arena-language').value === 'javascript' ? '2' : '4';
  preview(); renderHistory(); $('arena-status').textContent = 'New language selected.';
});
$('arena-indent').addEventListener('change', preview);
window.addEventListener('pagehide', () => { if (running) api.cancelCodeSession(); });
setRunning(false); preview(); renderHistory();
