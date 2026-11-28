// Original, static practice snippets. They are displayed as text and never executed.
const exercise = (id, language, tier, title, focus, source) => ({ id, language, tier, title, focus, source });
export const EXERCISES = Object.freeze([
  exercise('py-1a', 'python', 1, 'Even or odd', ['keyword', 'operator', 'indentation'], 'def parity(n):\n    if n % 2 == 0:\n        return "even"\n    return "odd"'),
  exercise('py-1b', 'python', 1, 'Count letters', ['string', 'bracket', 'punctuation'], 'def count_a(text):\n    return text.count("a")'),
  exercise('py-2', 'python', 2, 'Frequency map', ['indentation', 'bracket', 'operator'], 'def frequencies(items):\n    counts = {}\n    for item in items:\n        counts[item] = counts.get(item, 0) + 1\n    return counts'),
  exercise('py-3', 'python', 3, 'Unique sorted values', ['keyword', 'punctuation', 'bracket'], 'def unique_sorted(rows):\n    return sorted({\n        value\n        for row in rows\n        for value in row\n        if value is not None\n    })'),
  exercise('js-1a', 'javascript', 1, 'Double a value', ['keyword', 'operator', 'punctuation'], 'const double = (n) => {\n  return n * 2;\n};'),
  exercise('js-1b', 'javascript', 1, 'Greeting', ['string', 'bracket', 'indentation'], 'function greet(name) {\n  return "Hello, " + name;\n}'),
  exercise('js-2', 'javascript', 2, 'Filter and map', ['operator', 'bracket', 'punctuation'], 'function positives(values) {\n  return values.filter(n => n > 0).map(n => n * 2);\n}'),
  exercise('js-3', 'javascript', 3, 'Group by category', ['keyword', 'bracket', 'indentation'], 'function group(items) {\n  const groups = new Map();\n  for (const item of items) {\n    const bucket = groups.get(item.type) || [];\n    bucket.push(item);\n    groups.set(item.type, bucket);\n  }\n  return groups;\n}'),
  exercise('c-1a', 'c', 1, 'Maximum', ['keyword', 'operator', 'bracket'], 'int max(int a, int b) {\n    return a > b ? a : b;\n}'),
  exercise('c-1b', 'c', 1, 'String length', ['identifier', 'punctuation', 'indentation'], 'int length(const char *s) {\n    int n = 0;\n    while (s[n] != 0) n++;\n    return n;\n}'),
  exercise('c-2', 'c', 2, 'Sum array', ['indentation', 'operator', 'bracket'], 'int sum(const int *a, int n) {\n    int total = 0;\n    for (int i = 0; i < n; i++) {\n        total += a[i];\n    }\n    return total;\n}'),
  exercise('c-3', 'c', 3, 'Reverse in place', ['operator', 'punctuation', 'indentation'], 'void reverse(int *a, int n) {\n    for (int i = 0; i < n / 2; i++) {\n        int j = n - i - 1;\n        int tmp = a[i];\n        a[i] = a[j];\n        a[j] = tmp;\n    }\n}'),
  exercise('cpp-1a', 'cpp', 1, 'Square template', ['keyword', 'operator', 'bracket'], 'template <typename T>\nT square(T value) {\n    return value * value;\n}'),
  exercise('cpp-1b', 'cpp', 1, 'Simple class', ['keyword', 'punctuation', 'indentation'], 'class Counter {\npublic:\n    int value = 0;\n    void increment() { value++; }\n};'),
  exercise('cpp-2', 'cpp', 2, 'Vector total', ['operator', 'bracket', 'indentation'], '#include <vector>\nint sum(const std::vector<int>& values) {\n    int total = 0;\n    for (int v : values) total += v;\n    return total;\n}'),
  exercise('cpp-3', 'cpp', 3, 'Sort and deduplicate', ['punctuation', 'bracket', 'keyword'], '#include <algorithm>\n#include <vector>\nvoid normalize(std::vector<int>& v) {\n    std::sort(v.begin(), v.end());\n    v.erase(std::unique(v.begin(), v.end()), v.end());\n}')
].map(item => Object.freeze({ ...item, focus: Object.freeze(item.focus) })));
