// Analytics & Heatmap Engine for KeyRush (BrokenKey) — Phase 1

export function getHeatmapIntensity(errCount) {
  if (!errCount || errCount <= 0) return 'intensity-0';
  if (errCount <= 2) return 'intensity-1';
  if (errCount <= 5) return 'intensity-2';
  if (errCount <= 9) return 'intensity-3';
  return 'intensity-4';
}

export function resolvePhysicalKey(code, key = '') {
  if (code) {
    if (code === 'Space') return 'SPACE';
    if (code === 'Enter') return 'ENTER';
    if (code.startsWith('Key') && code.length === 4) return code.slice(3).toUpperCase();
    if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
    if (code === 'BracketLeft') return '[';
    if (code === 'BracketRight') return ']';
    if (code === 'Quote') return "'";
    if (code === 'Backquote') return '`';
    if (code === 'Backslash') return '\\';
    if (code === 'Slash') return '/';
    if (code === 'Semicolon') return ';';
    if (code === 'Comma') return ',';
    if (code === 'Period') return '.';
    if (code === 'Minus') return '-';
    if (code === 'Equal') return '=';
  }
  // Fallback for virtual / mobile keyboards without physical code
  if (key === ' ') return 'SPACE';
  if (key === '\n' || key === 'Enter') return 'ENTER';
  if (typeof key === 'string' && key.length === 1) return key.toUpperCase();
  return null;
}

export function resolveExpectedKey(char) {
  if (!char) return null;
  if (char === ' ') return 'SPACE';
  if (char === '\n') return 'ENTER';
  return char.toUpperCase();
}

export function recordSubstitution(substitutions, expectedKey, pressedKey) {
  if (!expectedKey || !pressedKey || expectedKey === pressedKey) return substitutions;
  if (!substitutions[expectedKey]) {
    substitutions[expectedKey] = {};
  }
  substitutions[expectedKey][pressedKey] = (substitutions[expectedKey][pressedKey] || 0) + 1;
  return substitutions;
}

export function getTopSubstitution(substitutions, expectedKey) {
  const map = substitutions && substitutions[expectedKey];
  if (!map) return null;
  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { pressedKey: entries[0][0], count: entries[0][1] };
}

export function calculateRealWpm(correctCharacters, elapsedSeconds) {
  if (!elapsedSeconds || elapsedSeconds <= 0 || !correctCharacters) return 0;
  const elapsedMinutes = elapsedSeconds / 60;
  return Math.round((correctCharacters / 5) / elapsedMinutes);
}

export function countExpectedKeys(passage, typedText) {
  const counts = {};
  const observedText = String(typedText || '');

  for (let index = 0; index < observedText.length && index < passage.length; index++) {
    const key = resolveExpectedKey(passage[index]);
    if (key) counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

export function buildCoachProfile(sessions) {
  const profile = {};

  for (const session of Array.isArray(sessions) ? sessions : []) {
    const attempts = session && session.observedCounts ? session.observedCounts : {};
    const mistakes = session && session.keyMistakes ? session.keyMistakes : {};
    const substitutions = session && session.keySubstitutions ? session.keySubstitutions : {};

    Object.entries(attempts).forEach(([key, count]) => {
      if (!profile[key]) profile[key] = { attempts: 0, mistakes: 0, substitutions: {} };
      profile[key].attempts += Number(count) || 0;
    });

    Object.entries(mistakes).forEach(([key, count]) => {
      if (!profile[key]) profile[key] = { attempts: 0, mistakes: 0, substitutions: {} };
      profile[key].mistakes += Number(count) || 0;
    });

    Object.entries(substitutions).forEach(([expectedKey, pressedKeys]) => {
      if (!profile[expectedKey]) profile[expectedKey] = { attempts: 0, mistakes: 0, substitutions: {} };
      Object.entries(pressedKeys || {}).forEach(([pressedKey, count]) => {
        profile[expectedKey].substitutions[pressedKey] =
          (profile[expectedKey].substitutions[pressedKey] || 0) + (Number(count) || 0);
      });
    });
  }

  return profile;
}

export function getCoachWeaknesses(profile, minimumAttempts = 2) {
  return Object.entries(profile || {})
    .map(([key, data]) => {
      const attempts = Number(data.attempts) || 0;
      const mistakes = Number(data.mistakes) || 0;
      const errorRate = attempts > 0 ? mistakes / attempts : 0;
      const topSubstitution = getTopSubstitution({ [key]: data.substitutions }, key);
      return { key, attempts, mistakes, errorRate, topSubstitution };
    })
    .filter((item) => item.attempts >= minimumAttempts && item.mistakes > 0)
    .sort((a, b) => {
      if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
      return b.mistakes - a.mistakes;
    });
}

export function generateCoachDrill(passages, weaknesses, targetWords = 18) {
  const weakKeys = new Set((weaknesses || []).slice(0, 5).map((item) => item.key));
  const words = (Array.isArray(passages) ? passages : [])
    .flatMap((passage) => String(passage).match(/[^\s]+/g) || [])
    .map((word, index) => {
      const score = [...word.toUpperCase()].reduce(
        (total, character) => total + (weakKeys.has(character) ? 1 : 0),
        0
      );
      return { word, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.word);

  const fallbackWords = (Array.isArray(passages) ? passages : [])
    .flatMap((passage) => String(passage).match(/[^\s]+/g) || []);
  const candidates = [...new Set([...words, ...fallbackWords])];
  const selected = [];
  const requestedWords = Math.max(10, targetWords);
  for (let index = 0; index < requestedWords && candidates.length > 0; index++) {
    selected.push(candidates[index % candidates.length]);
  }
  return selected.join(' ');
}
