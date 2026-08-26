---
name: audit-ui-ux-then-redesign
description: Audit an existing UI page against its own design system, then decide whether and how to redesign it. Use when the user says a page looks wrong or does not fit but cannot explain why. Not for building new components from scratch, debugging, fixing bugs, or when no code or design system exists.
---

# Audit UI/UX then Redesign

> **A redesign brief is only as good as the decision chain that produces it.**

This skill turns vague feedback into a conditional, mobile-first redesign brief. It runs a short, opinionated pipeline: scope → read → classify → audit → decide → brief.

It uses code, DOM, computed styles, and the design system. It does not use image-based vision.

## When to Use

- The user says a page is "off", "doesn't fit", or "looks wrong" but cannot describe specifics.
- A page needs a redesign brief before implementation.
- The project has an existing design system and shared components.

## When NOT to Use

- Building a brand-new component from a raw idea → `design-from-idea`.
- Fixing a bug or logic error.
- The page has no design system, no tokens, and no shared components.
- The project is a desktop-only tool and mobile is explicitly out of scope.
- The user only has a screenshot and no code access.

## Decision Pipeline

```text
1. SCOPE & ELICIT  → define the problem and the design read
2. READ & MAP      → understand the page from code and DOM
3. CLASSIFY        → place every element in the component system
4. AUDIT           → find high-leverage issues
5. DECIDE          → choose what to change, keep, or reject
6. BRIEF & VERIFY  → ship an implementable brief
```

---

## Step 1 — Scope & Elicit

> **If you don't know what wrong feels like, you can't fix it.**

**Actions:**
- Identify the page: file path, route, or component name.
- Detect vague feedback. If vague, run `ELICIT.md`.
- Decide page kind: landing, app, dashboard, settings, onboarding.
- Decide device context: mobile-first by default; desktop-first only if the project says so.
- Produce a one-line **Design Read**.

**Guard:** You have a Design Read, page kind, device context, and either user confirmation or enough evidence.

**Loop back:** If the user cannot answer and the codebase has no evidence, stop and ask for a reference URL or example.

---

## Step 2 — Read & Map

> **Understand the structure before judging it.**

**Actions:**
- Read the page component, children, CSS, and tokens.
- If a browser is available, inspect computed styles, DOM, and the accessibility tree. **Do not use image vision.**
- Draw ASCII wireframes for 320px and 1280px.
- Produce inventories: function, state, content, components, tokens, layout, motion.

**Guard:** You can answer:
1. What is the user's primary job on this page?
2. How many secondary jobs?
3. What states can the page be in?
4. What is the visual hierarchy at 320px?
5. What changes at 1280px?

**Loop back:** If the ASCII does not match the DOM or the 5 questions cannot be answered, re-read.

---

## Step 3 — Classify

> **Every element must earn its place in the system.**

**Actions:**
- For each UI element, map it to an Atomic Design layer.
- Decide: **reuse / extend / create / remove**. See `TAXONOMY.md`.
- Check the box contract: Header / Body / Footer / Aside.
- Flag any new token or component that would be needed.

**Guard:** Every element has a classification with a reason. No page skips layers. No new token is introduced without a reason.

**Loop back:** If an element cannot be classified, decompose it or ask whether it should exist.

---

## Step 4 — Audit

> **Audit for leverage, not for exhaustiveness.**

**Actions:**
- Choose depth: quick / standard / deep. See `AUDIT.md`.
- Run `AUDIT.md` for visual, layout, interaction, and design-system issues.
- Run `MOTION.md` for motion audit.
- Stop when you have one P0 or two P1 findings that explain the user's feedback.

**Guard:** Every finding is tied to a named design principle and has a severity.

**Loop back:** If only P2/P3 findings, ask the user whether to stop.

---

## Step 5 — Decide

> **Design is choosing what not to do.**

**Actions:**
- Derive **3 dials** from evidence, not from the preset table.
- For each finding, produce: **Current → Proposed → Risk**.
- Decide what to **change**, **keep**, or **reject**.
- Check technical feasibility: bundle size, SSR, shadow DOM, performance, `prefers-reduced-motion`.

**Guard:** Every proposed change has a reason, a risk, and a principle. No change violates technical constraints.

**Loop back:** If a proposal is high-risk, choose a safer alternative or escalate to the user.

### 3 Dials — Derivation

| Dial | Question to answer from evidence |
|---|---|
| **DESIGN_VARIANCE** | Does the page need more structure or more expression? A broken grid is a symptom; a calm page wants low variance. |
| **MOTION_INTENSITY** | How often is the animation seen? High-frequency tool → 1–3. Onboarding/landing → can be 6–8. |
| **VISUAL_DENSITY** | How much information lives in one viewport? Dashboard → 7–10. Marketing → 2–4. |

Use the presets in `AUDIT.md` only as a sanity check, not as a starting point.

---

## Step 6 — Brief & Verify

> **A brief must be implementable and verifiable.**

**Actions:**
- Fill `BRIEF-TEMPLATE.md` with Current / Proposed / Risk.
- Run the design-system audit commands from `AUDIT.md`.
- Run `npm run build` and `npm run typecheck` if code was changed.
- Append one line to `self-evolution/RUNBOOK.md`.

**Guard:** The brief is complete enough for another agent to implement, passes the design-system audit, **and one line has been appended to `self-evolution/RUNBOOK.md`. Do not commit until RUNBOOK is updated.**

**Loop back:** If the audit or build fails, return to Step 5.

---

## Technical Feasibility Gate

Before finalizing any proposal, check:

| Question | Why it matters |
|---|---|
| Does it need new dependencies? | Bundle size and supply chain risk |
| Does it work in shadow DOM / extension context? | Some projects use shadow DOM |
| Is it SSR-safe? | Hydration and layout shift |
| Does it pass `prefers-reduced-motion`? | Accessibility |
| Does it add unbounded z-index? | Stacking context bugs |
| Does it respect the token file? | No hardcoded values |

---

## Output Format

The brief must use this table:

```markdown
| Finding | Current | Proposed | Risk | Priority | Principle |
|---|---|---|---|---|---|
```

See `BRIEF-TEMPLATE.md` for the full template.

---

## Anti-Patterns

| Don't | Why |
|---|---|
| Enumerate every flaw | Audits should stop at leverage. |
| Copy a reference 1:1 | References teach principles, not output. |
| Add motion because it is "premium" | Motion is a risk, not a feature. |
| Hardcode values in the brief | The brief must map to tokens. |
| Ask open-ended questions | Use binary or one-choice questions. |
| Design desktop first | Default is mobile-first. |
| Ignore technical constraints | A brief you cannot build is worthless. |
| Skip `prefers-reduced-motion` | Accessibility is not optional. |

## Common Rationalizations

| User says | Respond with |
|---|---|
| "Just make it look better" | "Better for whom, doing what, on which screen?" |
| "I don't like it" | "What feels off: too dense, too bright, too busy, or too plain?" |
| "Make it like YouTube" | "Which specific feeling: pill controls, glass layers, or dark theme?" |
| "Use blue and green" | "Which is dominant, which is accent, and what neutral ties them?" |

## Verification Checklist

- [ ] Page and design system located.
- [ ] Vague feedback elicited (if needed) using `ELICIT.md`.
- [ ] Design Read declared with evidence.
- [ ] ASCII wireframes for 320px and 1280px.
- [ ] Component taxonomy done: reuse/extend/create/remove.
- [ ] Audits run with at least one P0 or two P1 findings.
- [ ] 3 dials derived from evidence.
- [ ] Every finding has Current / Proposed / Risk.
- [ ] Technical feasibility checked.
- [ ] Brief uses `BRIEF-TEMPLATE.md`.
- [ ] Design-system audit commands pass.
- [ ] Build / typecheck pass (if code changed).
- [ ] `self-evolution/RUNBOOK.md` updated.

## Validation

Before shipping or updating this skill, run at least one test case from `self-evolution/test_cases.md`.
Record the result in `self-evolution/RUNBOOK.md`.
If the skill does not improve the decision, fix the skill, not the test case.

## Self-Evolution

After every run — audit, brief, or implementation — append one line to `self-evolution/RUNBOOK.md`.
When `RUNBOOK.md` has 5+ entries or a test case fails, run `self-evolution/workflow.md`.

## Router Boomerang

Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route.
