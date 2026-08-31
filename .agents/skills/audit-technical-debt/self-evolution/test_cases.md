# Test cases for `audit-technical-debt`

## Test case 1 — Current project

**Input:** User says "Audit technical debt in this project."
**Expected output:** A structured audit brief with scope, signals, classification, scoring, business impact, and roadmap.

## Scoring rubric for audit output

Score the skill's output on a 0-5 scale for each criterion. Total = 30. Pass threshold = 22.

| # | Criterion | 5 | 3 | 1 | Weight |
|---|---|---|---|---|---|
| 1 | Scope concreteness | One-line scope with file/module/feature boundary | Scope is broad but bounded by type or risk | Scope is "everything" or missing | 1.0 |
| 2 | Signal diversity | ≥3 automatic signals (markers, coverage, dependencies) + human signal | 2 signals, no human signal | <2 signals | 1.0 |
| 3 | Classification correctness | Each item in the right 6-type bucket; no double-classified items | Mostly correct; a few ambiguous | Many misclassified or missing | 1.0 |
| 4 | Scoring completeness | Every item has 4 criteria and weighted score | Some missing weights or scores | No scoring formula | 1.0 |
| 5 | Business translation | Top 3 items translated to product cost/risk | Some translation, still technical | No translation | 1.0 |
| 6 | Roadmap actionability | Quick win + pay-down + watch + cadence/owner | Some items, no cadence | No roadmap | 1.0 |

## Scoring rubric for skill quality

Use these to evaluate whether the skill itself improved.

| # | Criterion | 5 | 3 | 1 |
|---|---|---|---|---|
| 7 | Workflow clarity | Every step has purpose, actions, guard, loop-back | Some steps missing guards | Steps are vague |
| 8 | Template usefulness | Output template can be copied and filled | Template is missing parts | No template |
| 9 | Anti-pattern coverage | ≥5 anti-patterns or rationalizations | 2-4 | <2 |
| 10 | Falsifiability | Guards are pass/fail conditions | Some guards are advice | No guards |

## Regression cases

- **Out-of-scope request:** "Fix the login button color" → skill should not activate.
- **Vague request:** "Clean up the code" → skill should ask scoping questions.
- **Specific module:** "Audit debt in src/features/subtitle" → skill should produce a module-level audit.
