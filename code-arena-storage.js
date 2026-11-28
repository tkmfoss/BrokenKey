import { KINDS, LANGUAGES } from './code-arena-core.js';
export const STORAGE_KEY = 'brokenkey.code-arena.v1';
export const MAX_SESSIONS = 100;
const integer = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
export function validSession(session) {
  return !!session && typeof session.id === 'string' && session.id.length > 0 && session.id.length <= 100 &&
    LANGUAGES.includes(session.language) && typeof session.exerciseId === 'string' && session.exerciseId.length <= 100 &&
    Number.isSafeInteger(session.completedAt) && session.completedAt >= 0 &&
    integer(session.wpm) && integer(session.accuracy) && session.accuracy <= 100 &&
    KINDS.every(kind => {
      const value = session.counts?.[kind];
      return value && integer(value.attempts) && integer(value.errors) && value.errors <= value.attempts;
    });
}
export function loadHistory(storage) {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    if (raw?.version !== 1 || !Array.isArray(raw.sessions)) return [];
    const seen = new Set();
    return raw.sessions.filter(validSession).filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(-MAX_SESSIONS);
  } catch { return []; }
}
export function appendSession(history, session) {
  if (!validSession(session) || history.some(item => item.id === session.id)) return history;
  return [...history, session].slice(-MAX_SESSIONS);
}
export function saveHistory(storage, history) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, sessions: history.filter(validSession).slice(-MAX_SESSIONS) }));
    return true;
  } catch { return false; }
}
