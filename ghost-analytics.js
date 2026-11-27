(function (root) {
  "use strict";

  const GHOST_BEST_WPM_KEY = "keyrush-ghost-best-wpm";
  const GHOST_BEST_ACCURACY_KEY = "keyrush-ghost-best-accuracy";
  const GHOST_HISTORY_KEY = "keyrush-ghost-race-history";
  const MAX_HISTORY_ENTRIES = 20;

  function safeGetItem(storage, key) {
    try {
      return storage && typeof storage.getItem === "function"
        ? storage.getItem(key)
        : null;
    } catch (_err) {
      return null;
    }
  }

  function safeSetItem(storage, key, value) {
    try {
      if (storage && typeof storage.setItem === "function") {
        storage.setItem(key, String(value));
      }
      return true;
    } catch (_err) {
      return false;
    }
  }

  function safeRemoveItem(storage, key) {
    try {
      if (storage && typeof storage.removeItem === "function") {
        storage.removeItem(key);
      }
      return true;
    } catch (_err) {
      return false;
    }
  }

  function sanitizeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : fallback;
  }

  function sanitizeRaceEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const wpm = Math.round(sanitizeNumber(entry.wpm, -1));
    if (wpm < 0) return null;

    const accuracy = Math.min(100, Math.round(sanitizeNumber(entry.accuracy, 0) * 10) / 10);
    const score = Math.round(sanitizeNumber(entry.score, 0) * 100) / 100;
    const difficulty = typeof entry.difficulty === "string" && entry.difficulty
      ? entry.difficulty
      : "beginner";
    const outcome = typeof entry.outcome === "string" && entry.outcome
      ? entry.outcome
      : "COMPLETED";
    const timestamp = typeof entry.timestamp === "string" && entry.timestamp
      ? entry.timestamp
      : new Date().toISOString();

    return { wpm, accuracy, score, difficulty, outcome, timestamp };
  }

  function parseHistory(rawValue) {
    if (!rawValue) return [];
    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(sanitizeRaceEntry)
        .filter(Boolean)
        .slice(-MAX_HISTORY_ENTRIES);
    } catch (_err) {
      return [];
    }
  }

  function computeAnalyticsSummary(history, storedBestWpm = 0, storedBestAccuracy = 0) {
    const cleanHistory = Array.isArray(history)
      ? history.map(sanitizeRaceEntry).filter(Boolean)
      : [];

    const totalRaces = cleanHistory.length;
    const historyMaxWpm = cleanHistory.reduce((max, item) => Math.max(max, item.wpm), 0);
    const historyMaxAccuracy = cleanHistory.reduce((max, item) => Math.max(max, item.accuracy), 0);

    const bestWpm = Math.max(sanitizeNumber(storedBestWpm, 0), historyMaxWpm);
    const bestAccuracy = Math.min(
      100,
      Math.max(sanitizeNumber(storedBestAccuracy, 0), historyMaxAccuracy)
    );

    const totalWpm = cleanHistory.reduce((sum, item) => sum + item.wpm, 0);
    const averageWpm = totalRaces > 0 ? Math.round((totalWpm / totalRaces) * 10) / 10 : 0;
    const wins = cleanHistory.filter((item) => item.outcome === "YOU WIN!").length;

    return {
      bestWpm: Math.round(bestWpm),
      bestAccuracy: Math.round(bestAccuracy * 10) / 10,
      averageWpm,
      totalRaces,
      wins,
      history: cleanHistory,
    };
  }

  function loadGhostAnalytics(storage) {
    const storedBestWpm = sanitizeNumber(safeGetItem(storage, GHOST_BEST_WPM_KEY), 0);
    const storedBestAccuracy = sanitizeNumber(safeGetItem(storage, GHOST_BEST_ACCURACY_KEY), 0);
    const history = parseHistory(safeGetItem(storage, GHOST_HISTORY_KEY));
    return computeAnalyticsSummary(history, storedBestWpm, storedBestAccuracy);
  }

  function recordGhostRace(storage, entry) {
    const cleanEntry = sanitizeRaceEntry(entry);
    if (!cleanEntry) {
      return Object.assign(loadGhostAnalytics(storage), { isNewBestWpm: false });
    }

    const previous = loadGhostAnalytics(storage);
    const nextHistory = previous.history.concat(cleanEntry).slice(-MAX_HISTORY_ENTRIES);
    const isNewBestWpm = cleanEntry.wpm > previous.bestWpm && cleanEntry.wpm > 0;

    const nextBestWpm = Math.max(previous.bestWpm, cleanEntry.wpm);
    const nextBestAccuracy = Math.max(previous.bestAccuracy, cleanEntry.accuracy);

    safeSetItem(storage, GHOST_BEST_WPM_KEY, nextBestWpm);
    safeSetItem(storage, GHOST_BEST_ACCURACY_KEY, nextBestAccuracy);
    safeSetItem(storage, GHOST_HISTORY_KEY, JSON.stringify(nextHistory));

    const summary = computeAnalyticsSummary(nextHistory, nextBestWpm, nextBestAccuracy);
    return Object.assign(summary, { isNewBestWpm });
  }

  function clearGhostAnalytics(storage) {
    safeRemoveItem(storage, GHOST_BEST_WPM_KEY);
    safeRemoveItem(storage, GHOST_BEST_ACCURACY_KEY);
    safeRemoveItem(storage, GHOST_HISTORY_KEY);
    return computeAnalyticsSummary([], 0, 0);
  }

  const api = {
    GHOST_BEST_WPM_KEY,
    GHOST_BEST_ACCURACY_KEY,
    GHOST_HISTORY_KEY,
    MAX_HISTORY_ENTRIES,
    computeAnalyticsSummary,
    loadGhostAnalytics,
    recordGhostRace,
    clearGhostAnalytics,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GhostAnalytics = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
