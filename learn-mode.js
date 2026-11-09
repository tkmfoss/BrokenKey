import { LEARN_CATEGORIES, LEARN_LESSONS } from './learn-content.js';
import {
  completeLesson,
  getProgressSummary,
  loadProgress,
  recordLessonAccuracy,
  saveProgress,
  setLastAccessed
} from './learn-progress.js';

const isLearnPage = typeof document !== 'undefined' && document.body?.hasAttribute('data-learn-app');

if (isLearnPage) {
  const $ = (id) => document.getElementById(id);
  const lessonIds = LEARN_LESSONS.map((lesson) => lesson.id);
  const state = {
    activeCategory: 'all',
    activeLesson: null,
    activeStage: 'understand',
    typingComplete: false,
    typingMetrics: null,
    answerRevealed: false,
    progress: null
  };

  function getStorage() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  const storage = getStorage();
  state.progress = loadProgress(storage, lessonIds);

  function persistProgress() {
    saveProgress(storage, state.progress);
    renderProgress();
    renderLessons();
  }

  function createText(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function renderProgress() {
    const summary = getProgressSummary(state.progress, lessonIds);
    const label = $('learn-progress-label');
    const value = $('learn-progress-value');
    const bar = $('learn-progress-bar');
    const fill = $('learn-progress-fill');
    if (label) label.textContent = `${summary.completed} of ${summary.total} lessons completed`;
    if (value) value.textContent = `${summary.percentage}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(summary.percentage));
    if (fill) fill.style.width = `${summary.percentage}%`;

    const resume = $('learn-resume-button');
    const hasLastLesson = LEARN_LESSONS.some((lesson) => lesson.id === state.progress.lastAccessedLessonId);
    if (resume) resume.hidden = !hasLastLesson;
  }

  function getVisibleLessons() {
    return state.activeCategory === 'all'
      ? LEARN_LESSONS
      : LEARN_LESSONS.filter((lesson) => lesson.categoryId === state.activeCategory);
  }

  function renderFilters() {
    const container = $('learn-category-filters');
    if (!container) return;
    container.replaceChildren();
    const filters = [{ id: 'all', title: 'All topics' }, ...LEARN_CATEGORIES];
    filters.forEach((filter) => {
      const button = createText('button', `learn-filter${state.activeCategory === filter.id ? ' active' : ''}`, filter.title);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(state.activeCategory === filter.id));
      button.addEventListener('click', () => {
        state.activeCategory = filter.id;
        renderFilters();
        renderLessons();
      });
      container.append(button);
    });
  }

  function renderLessons() {
    const grid = $('learn-lessons-grid');
    const empty = $('learn-empty-state');
    if (!grid) return;
    grid.replaceChildren();
    const lessons = getVisibleLessons();
    if (empty) empty.hidden = lessons.length > 0;

    lessons.forEach((lesson) => {
      const category = LEARN_CATEGORIES.find((item) => item.id === lesson.categoryId);
      const completed = state.progress.completedLessonIds.includes(lesson.id);
      const bestAccuracy = state.progress.bestAccuracyByLesson[lesson.id];
      const card = createText('button', 'learn-lesson-card');
      card.type = 'button';
      card.setAttribute('aria-label', `${lesson.title}, ${lesson.difficulty}${completed ? ', completed' : ''}. Open lesson.`);

      const top = createText('span', 'learn-lesson-card-top');
      top.append(
        createText('span', 'learn-lesson-category', category?.title || 'Computer Science'),
        createText('span', 'learn-lesson-difficulty', lesson.difficulty)
      );
      const heading = createText('span', '', lesson.title);
      heading.className = 'learn-card-title';
      const description = createText('span', 'learn-lesson-card-description', lesson.learningObjective);
      const bottom = createText('span', 'learn-lesson-card-bottom');
      bottom.append(
        createText('span', '', bestAccuracy === undefined ? 'Not attempted' : `Best accuracy ${bestAccuracy}%`),
        createText('strong', '', completed ? 'COMPLETED ✓' : `LESSON 0${LEARN_LESSONS.indexOf(lesson) + 1} ↗`)
      );
      card.append(top, heading, description, bottom);
      card.addEventListener('click', () => openLesson(lesson.id));
      grid.append(card);
    });
  }

  function showCatalog() {
    cancelTypingSession();
    $('learn-catalog').hidden = false;
    $('learn-lesson-view').hidden = true;
    renderProgress();
    renderLessons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openLesson(lessonId) {
    const lesson = LEARN_LESSONS.find((item) => item.id === lessonId);
    if (!lesson) return;
    cancelTypingSession();
    state.activeLesson = lesson;
    state.typingComplete = false;
    state.typingMetrics = null;
    state.progress = setLastAccessed(state.progress, lesson.id, lessonIds);
    persistProgress();

    $('learn-catalog').hidden = true;
    $('learn-lesson-view').hidden = false;
    $('learn-lesson-category').textContent = LEARN_CATEGORIES.find((item) => item.id === lesson.categoryId)?.title || 'Computer Science';
    $('learn-lesson-difficulty').textContent = lesson.difficulty;
    $('learn-lesson-title').textContent = lesson.title;
    $('learn-lesson-objective').textContent = lesson.learningObjective;
    $('learn-explanation').textContent = lesson.explanation;
    $('learn-example-title').textContent = lesson.exampleTitle;
    $('learn-example-copy').textContent = lesson.practicalExample;
    $('learn-recall-question').textContent = lesson.recallQuestion;
    $('learn-answer-input').value = '';
    $('learn-answer-review').hidden = true;
    $('learn-answer-input').disabled = false;
    $('learn-submit-answer').hidden = false;
    $('learn-typing-status').textContent = 'Your typing session is ready.';

    const referenceList = $('learn-references-list');
    referenceList.replaceChildren();
    lesson.references.forEach((reference) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = reference.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = reference.label;
      item.append(link);
      referenceList.append(item);
    });

    $('learn-lesson-position').textContent = `LESSON ${String(LEARN_LESSONS.indexOf(lesson) + 1).padStart(2, '0')} / ${String(LEARN_LESSONS.length).padStart(2, '0')}`;
    showStage('understand');
    $('learn-complete-panel').hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showStage(stage) {
    const allowed = ['understand', 'type', 'recall'];
    if (!allowed.includes(stage)) return;
    if (stage === 'recall' && !state.typingComplete) return;
    state.activeStage = stage;
    $('learn-understand-panel').hidden = stage !== 'understand';
    $('learn-type-panel').hidden = stage !== 'type';
    $('learn-recall-panel').hidden = stage !== 'recall';
    $('learn-complete-panel').hidden = true;

    const stageOrder = ['understand', 'type', 'recall'];
    document.querySelectorAll('[data-step-indicator]').forEach((indicator) => {
      const indicatorStage = indicator.dataset.stepIndicator;
      const active = indicatorStage === stage;
      const done = stageOrder.indexOf(indicatorStage) < stageOrder.indexOf(stage);
      indicator.classList.toggle('active', active);
      indicator.classList.toggle('done', done);
      if (active) indicator.setAttribute('aria-current', 'step');
      else indicator.removeAttribute('aria-current');
    });
  }

  function cancelTypingSession() {
    try {
      window.BrokenKeyTyping?.cancelLearningSession();
    } catch {
      // The lesson UI should remain navigable even if the engine adapter is unavailable.
    }
  }

  function beginTyping() {
    if (!state.activeLesson) return;
    state.typingComplete = false;
    state.typingMetrics = null;
    $('learn-typing-status').textContent = 'Type the passage to complete this stage.';
    showStage('type');
    const started = window.BrokenKeyTyping?.startLearningSession(
      state.activeLesson.typingPassage,
      (metrics) => {
        state.typingComplete = true;
        state.typingMetrics = metrics;
        state.progress = recordLessonAccuracy(state.progress, state.activeLesson.id, metrics.accuracy, lessonIds);
        persistProgress();
        $('learn-typing-status').textContent = `Passage complete · ${metrics.wpm} WPM · ${metrics.accuracy}% accuracy. Your recall challenge is ready.`;
        $('learn-answer-input').value = '';
        $('learn-answer-review').hidden = true;
        $('learn-submit-answer').hidden = false;
        showStage('recall');
        $('learn-answer-input').focus();
      }
    );
    if (!started) {
      $('learn-typing-status').textContent = 'The typing engine could not start. Reload the page and try again.';
    }
  }

  function revealAnswer() {
    const answer = $('learn-answer-input').value.trim();
    if (!answer) {
      $('learn-answer-input').setCustomValidity('Write a short answer before revealing the reference.');
      $('learn-answer-input').reportValidity();
      return;
    }
    $('learn-answer-input').setCustomValidity('');
    $('learn-answer-input').disabled = true;
    $('learn-expected-answer').textContent = state.activeLesson.expectedAnswer;
    $('learn-answer-review').hidden = false;
    $('learn-submit-answer').hidden = true;
  }

  function finishLesson() {
    if (!state.activeLesson) return;
    cancelTypingSession();
    state.progress = completeLesson(state.progress, state.activeLesson.id, lessonIds);
    persistProgress();
    const summary = getProgressSummary(state.progress, lessonIds);
    const best = state.progress.bestAccuracyByLesson[state.activeLesson.id];
    $('learn-lesson-view').hidden = false;
    $('learn-understand-panel').hidden = true;
    $('learn-type-panel').hidden = true;
    $('learn-recall-panel').hidden = true;
    $('learn-complete-panel').hidden = false;
    $('learn-complete-accuracy').textContent = best === undefined ? '—' : `${best}%`;
    $('learn-complete-count').textContent = `${summary.completed} / ${summary.total}`;
    const allDone = summary.completed === summary.total;
    $('learn-complete-copy').textContent = allDone
      ? 'You have completed all six initial lessons. Revisit any topic to reinforce it.'
      : 'You completed the lesson and marked the concept as remembered. Your progress is saved on this device.';
    $('learn-next-lesson').textContent = allDone ? 'Back to all lessons ↗' : 'Next lesson ↗';
    $('learn-next-lesson').dataset.allDone = String(allDone);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openNextLesson() {
    if ($('learn-next-lesson').dataset.allDone === 'true') {
      showCatalog();
      return;
    }
    const currentIndex = LEARN_LESSONS.findIndex((lesson) => lesson.id === state.activeLesson?.id);
    for (let offset = 1; offset <= LEARN_LESSONS.length; offset += 1) {
      const candidate = LEARN_LESSONS[(currentIndex + offset) % LEARN_LESSONS.length];
      if (!state.progress.completedLessonIds.includes(candidate.id)) {
        openLesson(candidate.id);
        return;
      }
    }
    showCatalog();
  }

  $('learn-back-to-catalog').addEventListener('click', showCatalog);
  $('learn-back-to-understand').addEventListener('click', () => {
    cancelTypingSession();
    state.typingComplete = false;
    showStage('understand');
  });
  $('learn-start-typing').addEventListener('click', beginTyping);
  $('learn-retry-typing').addEventListener('click', beginTyping);
  $('learn-submit-answer').addEventListener('click', revealAnswer);
  $('learn-remembered').addEventListener('click', finishLesson);
  $('learn-review-again').addEventListener('click', () => {
    cancelTypingSession();
    state.typingComplete = false;
    $('learn-answer-input').disabled = false;
    $('learn-answer-input').value = '';
    $('learn-answer-review').hidden = true;
    $('learn-submit-answer').hidden = false;
    showStage('understand');
  });
  $('learn-finish-back').addEventListener('click', showCatalog);
  $('learn-next-lesson').addEventListener('click', openNextLesson);
  $('learn-resume-button').addEventListener('click', () => {
    if (state.progress.lastAccessedLessonId) openLesson(state.progress.lastAccessedLessonId);
  });
  $('learn-answer-input').addEventListener('input', () => $('learn-answer-input').setCustomValidity(''));

  window.addEventListener('pagehide', cancelTypingSession);
  renderFilters();
  renderProgress();
  renderLessons();
}
