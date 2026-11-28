// Lexical analysis of curated code passages, not a compiler or syntax validator.
export const LANGUAGES = Object.freeze(['python', 'javascript', 'c', 'cpp']);
export const KINDS = Object.freeze(['keyword', 'identifier', 'number', 'string', 'comment', 'operator', 'bracket', 'punctuation', 'indentation', 'whitespace', 'other']);
const words = value => new Set(value.split(' '));
const cWords = 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while inline restrict _Bool _Static_assert';
const keywords = {
  python: words('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'),
  javascript: words('async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield'),
  c: words(cWords),
  cpp: words(cWords + ' alignas alignof bool catch class concept constexpr consteval constinit decltype delete explicit false friend mutable namespace new noexcept nullptr operator private protected public requires template this thread_local throw true try typename using virtual wchar_t')
};
export function tokenize(source, language) {
  if (typeof source !== 'string' || !LANGUAGES.includes(language)) throw new TypeError('Unsupported source or language');
  const result = [];
  let offset = 0, lineStart = true;
  while (offset < source.length) {
    const rest = source.slice(offset);
    let kind, value;
    const take = (type, pattern) => {
      if (value !== undefined) return;
      const match = pattern.exec(rest);
      if (match) { kind = type; value = match[0]; }
    };
    if (language === 'python') {
      take('comment', /^#[^\n]*/);
      take('string', /^(?:[rRuUbBfF]{0,2})(?:"""(?:\\[\s\S]|(?!""")[\s\S])*?(?:"""|$)|'''(?:\\[\s\S]|(?!''')[\s\S])*?(?:'''|$))/);
      take('string', /^(?:[rRuUbBfF]{0,2})(?:"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/);
    } else {
      take('comment', /^\/\/[^\n]*/);
      take('comment', /^\/\*[\s\S]*?(?:\*\/|$)/);
      if (language === 'javascript') take('string', /^\x60(?:\\[\s\S]|[^\x60\\])*\x60?/);
      take('string', /^(?:"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/);
    }
    take(lineStart ? 'indentation' : 'whitespace', /^[ \t]+/);
    take('whitespace', /^\r?\n/);
    take('number', /^(?:0[xX][\da-fA-F]+|0[bB][01]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/);
    take('identifier', /^[A-Za-z_$][\w$]*/);
    if (kind === 'identifier' && keywords[language].has(value)) kind = 'keyword';
    take('bracket', /^[()[\]{}]/);
    take('punctuation', /^[,;:.#]/);
    take('operator', /^(?:===|!==|>>>|<<=|>>=|\*\*=|\/\/=|==|!=|<=|>=|=>|->|\+\+|--|&&|\|\||<<|>>|\+=|-=|\*=|\/=|%=|\*\*|\/\/|[+\-*\/%=<>!&|^~?])/);
    if (value === undefined) { kind = 'other'; value = rest[0]; }
    result.push({ kind, value, start: offset, end: offset + value.length });
    offset += value.length;
    if (value.endsWith('\n')) lineStart = true;
    else if (kind !== 'indentation') lineStart = false;
  }
  return result;
}

export function emptyCounts() {
  return Object.fromEntries(KINDS.map(kind => [kind, { attempts: 0, errors: 0 }]));
}

// A code-specific projection of input attempts onto expected token positions.
// The shared typing engine remains responsible for WPM, timing and completion.
export function createAttemptTracker(source, language) {
  const tokens = tokenize(source, language);
  const positions = [];
  for (const token of tokens) for (let i = token.start; i < token.end; i++) positions[i] = token.kind;
  const counts = emptyCounts();
  return {
    record(start, inserted) {
      if (!Number.isSafeInteger(start) || start < 0 || typeof inserted !== 'string') return;
      for (let i = 0; i < inserted.length && start + i < source.length; i++) {
        const count = counts[positions[start + i]];
        count.attempts++;
        if (inserted[i] !== source[start + i]) count.errors++;
      }
    },
    snapshot() { return Object.fromEntries(KINDS.map(kind => [kind, { ...counts[kind] }])); }
  };
}

// Prefer the pre-edit selection (including replacement of identical characters).
// Prefix/suffix diff is a fallback for keyboards that omit beforeinput.
export function getInsertion(previous, current, selection = null) {
  if (typeof previous !== 'string' || typeof current !== 'string') return null;
  if (selection && Number.isInteger(selection.start) && Number.isInteger(selection.end) &&
      selection.start >= 0 && selection.start <= selection.end && selection.end <= previous.length) {
    const prefix = previous.slice(0, selection.start), suffix = previous.slice(selection.end);
    if (current.length >= prefix.length + suffix.length && current.startsWith(prefix) && current.endsWith(suffix)) {
      return { start: selection.start, inserted: current.slice(prefix.length, current.length - suffix.length) };
    }
  }
  let start = 0, suffix = 0;
  while (start < previous.length && start < current.length && previous[start] === current[start]) start++;
  while (suffix < previous.length - start && suffix < current.length - start &&
    previous[previous.length - 1 - suffix] === current[current.length - 1 - suffix]) suffix++;
  return { start, inserted: current.slice(start, current.length - suffix) };
}

export function weakestConstructs(sessions, language, minimumAttempts = 5) {
  const totals = emptyCounts();
  for (const session of sessions) {
    if (session.language !== language) continue;
    for (const kind of KINDS) {
      totals[kind].attempts += session.counts[kind].attempts;
      totals[kind].errors += session.counts[kind].errors;
    }
  }
  return KINDS.filter(kind => !['whitespace', 'other'].includes(kind))
    .map(kind => ({ kind, ...totals[kind], rate: totals[kind].attempts ? totals[kind].errors / totals[kind].attempts : 0 }))
    .filter(item => item.attempts >= minimumAttempts && item.errors > 0)
    .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

export function selectExercise(catalog, sessions, language) {
  const candidates = catalog.filter(item => item.language === language);
  if (!candidates.length) return null;
  const history = sessions.filter(item => item.language === language).slice(-3);
  const attempts = history.reduce((sum, item) => sum + KINDS.reduce((n, k) => n + item.counts[k].attempts, 0), 0);
  const errors = history.reduce((sum, item) => sum + KINDS.reduce((n, k) => n + item.counts[k].errors, 0), 0);
  const accuracy = attempts ? 1 - errors / attempts : 0;
  const averageWpm = history.length ? history.reduce((sum, item) => sum + item.wpm, 0) / history.length : 0;
  const last = history.at(-1);
  let tier = candidates.find(item => item.id === last?.exerciseId)?.tier || 1;
  if (history.length >= 2 && attempts >= 30) {
    if (accuracy >= .96 && averageWpm >= 25) tier = Math.min(3, tier + 1);
    else if (accuracy < .8) tier = Math.max(1, tier - 1);
  }
  const weak = weakestConstructs(history, language).slice(0, 2);
  const score = item => weak.reduce((sum, target) => sum + (item.focus.includes(target.kind) ? target.rate : 0), 0);
  return candidates.slice().sort((a, b) =>
    Math.abs(a.tier - tier) - Math.abs(b.tier - tier) ||
    score(b) - score(a) ||
    Number(a.id === last?.exerciseId) - Number(b.id === last?.exerciseId) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )[0];
}

export function formatIndentation(source, language, indent) {
  if (!LANGUAGES.includes(language) || !['  ', '    ', '\t'].includes(indent)) throw new TypeError('Invalid indentation');
  const width = language === 'javascript' ? 2 : 4;
  return source.replace(/^ +/gm, spaces => indent.repeat(Math.floor(spaces.length / width)) + ' '.repeat(spaces.length % width));
}
