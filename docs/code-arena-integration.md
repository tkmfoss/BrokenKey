# Code Typing Arena (issue #59): scope and integration contract

Audit base: upstream 4e2ee6785cce06cc3607be28d80b5fe140a6d8e2.

- #53 / PR #55: general weak-key drills. Code Arena only ranks expected lexical constructs within one language, not physical keys or substitutions; no shared training-coach storage or UI.
- #49 / PR #61: Ghost Mode race analytics. No Ghost changes or competing global chart.
- #39 / PR #54: clipboard controls. The arena must reject paste/drop/replacement inputs and never award completion from pasted content.
- #35 / PR #36: timer and Backspace behavior. Preserve existing modes and native corrections.
- #57: learning and review scheduler. No changes to learning progress or spaced repetition.

Reuse the existing BrokenKeyTyping session interface from script.js for timer, input scoring, WPM and accuracy. Add a narrow code-session adapter, not a second typing engine. The new modules handle only lexical categories, attempt projection, exercise selection and bounded versioned code-specific history. Persist only completed sessions, not typed source. No changes to global best scores or existing storage keys.

The first implementation slice contains the original curated snippets (four languages, three tiers), lexical tokenizer, construct attempt tracker, deterministic selector, bounded storage and unit tests. The second slice integrates a dedicated page via the shared untimed session adapter, exact completion, code-only paste/drop restrictions, token highlighting, explicit indentation, attempt accuracy and deterministic adapter tests. General and Learn Mode behavior is preserved by opt-in code session hooks. Browser/mobile visual verification remains a separate acceptance check.

Lexical categories are not full-language parsers or compiler diagnostics: advanced constructs such as JavaScript regex literals, C++ raw strings and Python contextual keywords may require additional lexical rules if added to the curated corpus.

Code practice supports native Tab for indentation through the same validated insertion path as the on-screen button. Shift+Tab and Tab outside leading whitespace retain focus navigation; normal typing and Learn Mode are unaffected.
