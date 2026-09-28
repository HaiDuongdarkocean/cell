# Write-Skill — style guide & red flags

## Style rules

1. **Lead with a bold punchline** — each section opens with one bold sentence, not an explanation.
2. **Negative constraints** — "Don't"/"No" verify easier than "should".
3. **One bullet, one idea** — no nested bullets, no paragraph bullets.
4. **Tables over paragraphs** for options, symptoms, anti-patterns.
5. **Before/after over definitions** — "Write a test that reproduces it" beats "reproduce the bug".
6. **A self-check question beats a checklist** — "Would a senior engineer call this overcomplicated?" replaces five boxes.
7. **No meta-text** — never "This section will..." or "It is important to note...".
8. Concrete vocabulary: "surgical changes" yes, "holistic optimization" no.

## Top rationalizations

| Rationalization | Reality |
|---|---|
| "Just a few tips" | A skill is a workflow; tips go in a doc. |
| "Keep it short by removing guards" | Guards are the skill — without them it's a suggestion. |
| "Add code samples for concreteness" | Code techniques belong in `learning-and-apply` atoms. |
| "Body is good, description doesn't matter" | The body never runs if the description doesn't trigger. |

## Red flags

- No "When NOT to use"; no Router boomerang
- A step without a guard, or a guard that says "use your judgment"
- Sections opening with explanation instead of punchline
- Generic description ("Helps with development")
- >500 lines after editing
