---
name: audit-ui-ux-then-redesign
description: "Question-first UI/UX audit: reframe feedback into the right design question, critique, produce a redesign brief. Use before a redesign."
---

# Audit UI/UX then Redesign

> **The right question produces the right method.**

A question-first design audit: don't list what looks wrong — ask *what problem the design is supposed to solve*, then find where it fails that problem. Output is a conditional, evidence-based redesign brief another agent can implement.

## When to Use

- A page is "off", "doesn't fit", or "looks wrong"
- Before redesigning a page, component, or flow
- Validating a UI against the project's design system
- Before implementation, you need a redesign brief

**When NOT to use:** logic bugs → `debugging-and-error-recovery`; raw idea with no target → `pipeline-design`; no design system and no user context; pure copy tasks → `audit-text-in-ui`.

## Core Principle

> **Audit for root cause, not preference.** The root cause is found by asking the right question.

Every finding must: start with a question naming the design tension → name the aspect (taxonomy) → provide evidence (DOM, computed style, token, screenshot) → cite a standard → propose change/keep/reject with risk.

## Method in one pass

1. **Reframe** the complaint into a design question ("it's confusing" → "where does the hierarchy fail the primary job?")
2. **Climb L1→L3**: Observable (what do I see) → Structural (how does it relate) → Principle (why is it wrong)
3. **Name the design tension** — most problems are two valid principles in conflict (minimalism vs discoverability, calm vs urgency). Pick a side with evidence.
4. **Strip to first principles** — what would we build with no legacy? If ideal ties with constrained reality, choose ideal.
5. **Cross-context check** — if the fix only works on this screen, lift it one level (token/shared component).

## Source policy

- **Codebase wins.** Read `docs/design-system/DESIGN.md`, `src/shared/styles/STANDARD.md`, `tokens.json`, `src/shared/ui/*`, `docs/adr/` first.
- External sources allowed when the codebase is silent — state why you used them and reconcile conflicts (default: codebase).
- **SSOT check before any proposal:** if a fix requires editing >1 file, it probably belongs in the shared token/component, not the page.

## Audit taxonomy — 10 aspects

Run every aspect through the L1→L3 ladder; classify non-applicable ones in one sentence instead of skipping:

Strategy & Purpose · Interaction Flow · Information Architecture · Visual System · Layout & Responsive · Components & States · Motion & Feedback · Accessibility · Craft & Polish · SSOT & Maintainability

→ Per-aspect question ladders, 30-question screening checklist, and common failures: `references/audit-details.md`

## Decision pipeline

```text
0. REFRAME → 1. SCOPE → 2. READ → 3. CLASSIFY → 4. AUDIT → 5. DECIDE → 6. BRIEF → 7. VERIFY
```

- **Scope:** mobile-first by default (persona: 5–80 on any device). Produce a one-sentence Design Read.
- **Classify:** every element → reuse `src/shared/ui/*` / extend / create / remove (layer rules + decision tree: `TAXONOMY.md`).
- **Stop rule:** one P0 or two P1 findings that explain the user's feedback. Don't chase P2/P3 unless asked.
- **Verify:** design-system audit commands from `DESIGN.md` §8; `npm run typecheck && npm run build` if code changed; append `## Hand-off to pipeline-design` when the audit feeds a redesign.

Severity: **P0** blocker (function/a11y/SSOT) · **P1** major · **P2** minor · **P3** suggestion.

→ Per-step guards, finding template, and hand-off template: `references/audit-details.md`

## Anti-Patterns

| Don't | Why |
|---|---|
| Audit by personal taste | Without a principle it is not critique. |
| Skip the reframe step | You will answer the wrong question and produce a local fix. |
| Ask "is this beautiful?" | Beauty is not measurable. Ask which principle it violates. |
| Treat symptoms as root cause | A red error banner is not the problem — why the user sees it is. |
| Hardcode values in the brief | Every proposal must map to a token or shared component. |
| Skip mobile-first | Default persona is a learner on a phone. |
| Ignore `prefers-reduced-motion` | Accessibility is not optional. |
| Propose changes that violate SSOT | If one change needs five files, the fix is in the wrong place. |
| Rely only on image vision | Use DOM, computed styles, and code; vision is optional context. |

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
