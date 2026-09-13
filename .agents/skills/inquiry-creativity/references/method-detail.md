# Inquiry & Creativity — method detail

## Step 1 — Scope with 5W1H

- **What** exactly? (concept, comparison, implementation, best practice)
- **Why** does it matter for this project/persona?
- **Where** will the answer be used? (design, code, architecture, copy)
- **When** needed? **Who** is the audience? **How** delivered? (brief, table, questions, design)

Bloom target by phrasing: "là gì" → Remember/Understand · "làm thế nào" → Apply/Analyze · "có nên không" → Evaluate · "hãy tạo ra" → Create.

Loop back: can't answer 5W1H → one binary question at a time until scope is clear.

## Step 2 — Boolean query design

```text
"keyword chính" AND (bổ trợ 1 OR bổ trợ 2) NOT nhiễu
```

Extract main keyword + 2–3 supporting + 1–2 noise words. Same mindset for codebase `grep` and `web_search`. Run independent queries in parallel. Too much noise → add `NOT`; too few → broaden a specific term to a synonym.

## Step 3 — SIFT each source

- **S — Stop:** title/domain worth clicking? Skip clickbait and unauthored pages.
- **I — Investigate:** who wrote it? (.edu/.gov/official docs/expert vs anonymous blog)
- **F — Find better:** same claim from a more authoritative source?
- **T — Trace:** does it cite a paper/spec/official doc? No → downgrade.

Codebase sources skip SIFT but need: file path + line; current or deprecated (`git log`/`ROADMAP.md`); SSOT or downstream copy.

## Step 4 — Synthesize to Bloom target

Skim and extract: definitions, formulas/rules, real numbers/examples, trade-offs/limitations. Then deliver at the target level:

- **Remember:** bullet key facts · **Understand:** one paragraph in your words
- **Apply:** one concrete project use case · **Analyze:** compare 2+ approaches in a table
- **Evaluate:** pick + defend with criteria · **Create:** propose a new pattern/component/workflow from verified facts

Surface codebase-vs-internet conflicts and resolve (codebase wins project decisions; internet wins domain principles).

## Step 5 — Critique & converge

> A senior decision is not "A beats B"; it is "A is the best fit for these constraints, and here is the risk we accept."

1. **Expand:** ≥3 options. Only A/B given → 5 Whys to generate C/D/E.
2. **Must-haves vs nice-to-haves:** must-haves are non-negotiable project constraints (build passes, `tokens.css` not hand-edited, WCAG AA).
3. **Weighted matrix:** criteria map to project constraints (bundle size, build/test, responsive, a11y, SSOT, perf, maintenance, time-to-ship); weights sum to 100%; score 1–10 per criterion; weighted = score × weight.
4. **Confidence + risk** per option.
5. **5 Whys on the winner:** Why best fit? Why not a hybrid of A and C? Why can't we defer? Why still works in 6 months? Why would a senior disagree?
6. **80% stop:** ≥80% fit + no clearly better option → propose a small reversible experiment.

## Step 5.5 — First-principles / unconstrained best practice

1. **Strip constraints:** "infinite time, no legacy code, no tooling limits, no migration cost — what would we build?"
2. **Define the ideal** — cleanest, most reusable, theoretically correct solution to the root cause.
3. **Score the ideal** on the same matrix with purely local constraints relaxed (keep hard ones: WCAG, physics, security).
4. **Compare:** ideal higher → choose it + migration path; lower → constraints are real, choose constrained; **tied → choose the unconstrained best practice** (ages better).
5. If constrained wins, document: "We accept X because of Y constraint; the ideal solution is Z."

Loop back: can't describe the ideal without naming a current tool/file → still inside the constraints; ask again.

## Question bank (Socratic)

```text
1. What is the one keyword we are really trying to understand?
2. Why does this topic matter to the current project or user?
3. What would a wrong answer look like?
4. What does the codebase already believe about this?
5. What do the best external sources disagree on?
6. If we removed all decoration, what is the core principle?
7. How can we apply this to a real decision we are about to make?
8. What is the cheapest test that would prove or disprove this?
9. What would a senior in this domain question about our conclusion?
10. What new pattern can we build from these verified pieces?
11. Why is option A the best fit, and what risk do we accept?
12. What is a hybrid or third option we haven't considered?
13. If we removed all current constraints, what would the best solution look like?
14. Is the constrained winner tied with the unconstrained best practice? If so, why not choose it?
```
