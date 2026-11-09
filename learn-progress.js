export const LEARN_PROGRESS_KEY = 'brokenkey.learn-progress.v1';
export const LEARN_PROGRESS_VERSION = 1;

export function createInitialProgress() {
  return {
    version: LEARN_PROGRESS_VERSION,
    completedLessonIds: [],
    lastAccessedLessonId: null,
    bestAccuracyByLesson: {}
  };
}

export function normalizeProgress(value, validLessonIds = []) {
  const initial = createInitialProgress();
  const validIds = new Set(validLessonIds);
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== LEARN_PROGRESS_VERSION) {
    return initial;
  }

  const completedLessonIds = Array.isArray(value.completedLessonIds)
    ? [...new Set(value.completedLessonIds.filter((id) => typeof id === 'string' && validIds.has(id)))]
    : [];

  const bestAccuracyByLesson = {};
  if (value.bestAccuracyByLesson && typeof value.bestAccuracyByLesson === 'object' && !Array.isArray(value.bestAccuracyByLesson)) {
    Object.entries(value.bestAccuracyByLesson).forEach(([id, accuracy]) => {
      if (!validIds.has(id)) return;
      const number = Number(accuracy);
      if (Number.isFinite(number)) {
        bestAccuracyByLesson[id] = Math.max(0, Math.min(100, number));
      }
    });
  }

  return {
    version: LEARN_PROGRESS_VERSION,
    completedLessonIds,
    lastAccessedLessonId: validIds.has(value.lastAccessedLessonId) ? value.lastAccessedLessonId : null,
    bestAccuracyByLesson
  };
}

export function parseProgress(serialized, validLessonIds = []) {
  if (typeof serialized !== 'string' || serialized.length === 0) return createInitialProgress();
  try {
    return normalizeProgress(JSON.parse(serialized), validLessonIds);
  } catch {
    return createInitialProgress();
  }
}

export function loadProgress(storage, validLessonIds = []) {
  try {
    return parseProgress(storage ? storage.getItem(LEARN_PROGRESS_KEY) : null, validLessonIds);
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(storage, progress) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function setLastAccessed(progress, lessonId, validLessonIds = []) {
  if (!new Set(validLessonIds).has(lessonId)) return normalizeProgress(progress, validLessonIds);
  return { ...normalizeProgress(progress, validLessonIds), lastAccessedLessonId: lessonId };
}

export function recordLessonAccuracy(progress, lessonId, accuracy, validLessonIds = []) {
  const next = normalizeProgress(progress, validLessonIds);
  if (!new Set(validLessonIds).has(lessonId)) return next;
  const number = Number(accuracy);
  if (!Number.isFinite(number)) return next;
  const bounded = Math.max(0, Math.min(100, number));
  next.bestAccuracyByLesson[lessonId] = Math.max(next.bestAccuracyByLesson[lessonId] || 0, bounded);
  next.lastAccessedLessonId = lessonId;
  return next;
}

export function completeLesson(progress, lessonId, validLessonIds = []) {
  const next = normalizeProgress(progress, validLessonIds);
  if (!new Set(validLessonIds).has(lessonId)) return next;
  if (!next.completedLessonIds.includes(lessonId)) next.completedLessonIds.push(lessonId);
  next.lastAccessedLessonId = lessonId;
  return next;
}

export function getProgressSummary(progress, validLessonIds = []) {
  const normalized = normalizeProgress(progress, validLessonIds);
  const total = validLessonIds.length;
  const completed = normalized.completedLessonIds.length;
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100)
  };
}