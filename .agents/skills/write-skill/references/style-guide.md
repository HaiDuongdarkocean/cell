# Write-Skill — style guide, rationalizations, red flags

## Writing style

1. **Lead with a bold punchline.** Each section opens with one bold sentence stating the core idea. Good: `**Don't assume. Surface tradeoffs.**` Bad: a paragraph explaining why assumptions matter.
2. **Predictable rhythm.** heading → punchline → bullets → closing test, consistently.
3. **Negative constraints.** "Don't" and "No" verify easier than "should". `No features beyond what was asked` beats `Consider limiting scope`.
4. **One bullet, one idea.** One line each; no nested bullets.
5. **Replace definitions with before/after examples.** "Fix the bug" → "Write a test that reproduces it, then make it pass."
6. **Replace long checklists with a self-check question.** "Would a senior engineer say this is overcomplicated?" replaces five checkbox items.
7. **No meta-text.** Never "This section will..." or "It is important to note...".
8. **Tradeoffs in one line.** "These guidelines bias toward caution over speed. For trivial tasks, use judgment."
9. **Plain, concrete vocabulary.** "surgical changes" yes; "holistic optimization" no.

## Prose craft

- Omit needless words — every sentence earns its place.
- Active voice, short sentences; concrete nouns, active verbs, few modifiers.
- Write like you talk; read it aloud and fix what makes you stumble.
- One idea per sentence, one point per paragraph.
- Rewrite before shipping — the first draft discovers what you mean; later drafts cut.
- Zinsser's standard: clear first, then simple, then brief, then human. If a tradeoff is needed, clarity wins.

## Common rationalizations

| Rationalization | Reality |
|---|---|
| "It's just a few tips" | A skill is a workflow, not a list. Put tips in a doc. |
| "The more examples, the better" | Examples earn lines only if they reveal a guard or anti-pattern. |
| "I'll keep it short by removing guards" | Guards are the skill. Removing them makes it a suggestion. |
| "This skill covers everything" | Broad skills are ignored. Split by decision boundary. |
| "I'll add code samples so it's concrete" | Code techniques belong in `learning-and-apply` atoms, not skills. |
| "It's close enough to an existing skill" | If close, extend or replace. Don't duplicate. |
| "If the body is good, the description doesn't matter" | The body only runs if the description triggers the skill. |

## Red flags

- No "When NOT to use"
- No concrete template or checklist
- A step without a guard, or a guard that says "use your judgment"
- Long paragraphs where a table would work
- Sections opening with explanations instead of a punchline
- Bullets with multiple ideas or paragraphs
- Code implementation examples
- Generic description ("Helps with development")
- More than one decision per step
- No Router boomerang
- Over 500 lines after editing
