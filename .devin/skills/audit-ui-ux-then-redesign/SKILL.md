---
name: audit-ui-ux-then-redesign
description: Question-first UI/UX audit. Reframe user feedback into the right design question, then run a taxonomy-driven, evidence-based critique and produce a redesign brief. Use when a page feels off, before a redesign, or when validating a design system decision. Not for logic bugs, backend, or brand-new ideas without a target.
---

# Audit UI/UX then Redesign

> **The right question produces the right method. The right method works in more than one context.**

This skill is a **question-first design audit**. It does not start by listing what looks wrong. It starts by asking *what problem the design is supposed to solve*, then uses a taxonomy and evidence to find where the design fails that problem.

The output is a conditional, evidence-based redesign brief that any other agent can implement.

## When to Use

- The user says a page is "off", "doesn't fit", or "looks wrong".
- You are about to redesign a page, component, or flow.
- You want to validate whether a new UI matches the project's design system.
- You need a redesign brief before implementation.
- You want to compare a UI against first principles and generate a reusable method.

## When NOT to Use

- Fixing a logic bug or runtime error → use `debugging-and-error-recovery`.
- Building from a raw idea with no target page → use `idea-to-interface`.
- You already have an `idea-to-interface` brief that needs validation → run this audit, then hand the findings back to `idea-to-interface`.
- No design system, no tokens, no shared components, and no user context.
- Pure content/copy task with no visual or interaction change.

---

## Core Principle

> **Audit for root cause, not preference — and the root cause is found by asking the right question.**

A senior designer does not say "I don't like the blue". They ask:
> "What job is this color doing? Is it an accent, a semantic signal, or a background? Which rule does it break, and what is the cheapest, highest-leverage fix?"

Every finding in this skill must:
1. **Start with a question** that names the design tension.
2. **Name the aspect** (taxonomy).
3. **Provide evidence** (DOM, computed style, token, screenshot, or reference).
4. **Cite a standard** (codebase or external, with reasoning).
5. **Propose a change/keep/reject** with risk.

---

## Question-First Method

The taxonomy is a checklist. The question ladder is the method. The same ladder works for a page, a component, a flow, a color decision, or a design system rule.

### 0. Reframe the request

Before touching the taxonomy, turn the user's feeling into a design question.

| User complaint | Reframe into a design question |
|---|---|
| "It looks ugly" | "Which principle does it violate: color, spacing, typography, shape, or motion?" |
| "It's confusing" | "What is the primary job, and where does the hierarchy fail to support it?" |
| "Too slow" | "Is the bottleneck perceived performance (motion/layout) or cognitive load (too many choices)?" |
| "Doesn't fit" | "Which design system rule is broken: token, component, spacing, or shape?" |
| "Too dense" | "What is the right level of disclosure for this user at this step?" |
| "Looks cheap" | "Which detail breaks quiet confidence: color harmony, alignment, radius, or shadow?" |

### 1. Ask in three levels

Every audit question should climb from surface to principle.

| Level | Question type | Example |
|---|---|---|
| **L1 — Observable** | *What do I see?* | "The error banner is red and sits at the top of the panel." |
| **L2 — Structural** | *How does it relate?* | "The banner competes with the primary job because it is the most saturated element." |
| **L3 — Principle** | *Why is it wrong?* | "It breaks the neutral-first, single-accent rule and triggers anxiety before the user has done anything wrong." |

### 2. Find the design tension

Most UI problems are not "wrong vs right". They are tensions between two valid principles:
- **Minimalism vs. discoverability** (hide advanced fields / but power users need them).
- **Consistency vs. context** (use the same button / but this action is destructive).
- **Speed vs. safety** (one-tap action / but needs confirmation).
- **Calm vs. urgency** (quiet confidence / but errors need attention).

A good audit names the tension and picks a side with evidence. If you cannot name the tension, you are still at the symptom.

### 3. Strip to first principles

Ask: *If we remove the current implementation, current deadlines, and our favorite pattern, what is the ideal solution?*

Then compare the ideal to the constrained reality. If they tie, choose the ideal. If reality has a hard constraint (e.g., WCAG, MV3, low-end device), choose the constrained winner and document the gap.

### 4. Cross-context check

Ask:
- *If this method works for this screen, would it work for a similar screen?*
- *If we solve it with this pattern, how many other places can reuse the same pattern?*
- *Is the fix local, or does it belong in a shared token/component?*

If the answer is "only this screen", the method is too specific. Lift it one level.

---

## Source Policy: Codebase vs. Internet

A good designer has a library in their head and knows when to borrow. This skill does too.

### 1. Codebase is the primary source of truth

Always read the project's own standards first:

- `docs/design-system/DESIGN.md` — practical checklist and golden rules.
- `src/shared/styles/STANDARD.md` — principles, color, typography, spacing, motion, grid, accessibility.
- `src/shared/styles/tokens.json` → generated `tokens.css` — canonical token values.
- `src/shared/styles/README.md` — how to build and import tokens.
- `src/shared/ui/*` — shared components, their variants, states, and showcases.
- `docs/adr/` — architectural decisions that constrain UI.
- `AGENTS.md` — project conventions (no hardcode, SSOT, named exports, etc.).

**Rule of thumb:** If a question can be answered by the codebase, the codebase wins.

### 2. External knowledge is allowed with reasoning

You may search the web or use design references when:

- The codebase is silent on a specific pattern (e.g., how to style a nested accordion, a date-range picker, or a media timeline).
- You need to validate a WCAG rule, contrast math, or touch-target research.
- You want a reference for a *feeling* the user described (e.g., "like YouTube's player").
- You are stress-testing the project's own standard against industry practice.

**Requirement:** State *why* you used an external source and how you reconciled it with the codebase. If they conflict, default to the codebase unless the user explicitly asks to change the system.

### 3. SSOT check before any proposal

Before recommending a change, ask:

- Is this pattern already in `src/shared/ui/`? If yes, why isn't it being used?
- Is this value already a token? If not, should it become one?
- If I change this, how many other files must change? If the answer is >1, the page is violating SSOT and the fix may belong in the shared component/token, not the page.

---

## Audit Taxonomy

Use these nine aspects as the skeleton of every audit. For each aspect, run the **L1 → L2 → L3 question ladder**. Do not skip an aspect because it feels irrelevant — classify it as "not applicable" with one sentence.

### 1. Strategy & Purpose

> *Why does this page exist? Who is it for? What is the one primary job?*

**L1 — Observable:** What is the first thing a user sees? What can they do in one tap?

**L2 — Structural:** How many jobs are competing for primary attention? Are secondary jobs truly secondary?

**L3 — Principle:** Does the visual hierarchy match the user's primary job? Does it respect the project's persona and device context?

**Common failures:**
- Multiple primary CTAs fighting for attention.
- Marketing copy obscuring functional controls.
- Page tries to serve two personas with opposite needs.

### 2. Information Architecture

> *How is content grouped, labeled, and sequenced?*

**L1 — Observable:** What is grouped together? What is separated?

**L2 — Structural:** Does the grouping follow the user's mental model and the task sequence?

**L3 — Principle:** Does it use Gestalt proximity, progressive disclosure, and a clear reading order? Are empty, loading, and error states designed, not afterthoughts?

**Common failures:**
- Form fields scattered across unrelated cards.
- No empty state or generic "No data" without next step.
- Important metadata buried below the fold on mobile.

### 3. Visual System

> *Color, typography, spacing, shape, elevation — are they singing the same song?*

**L1 — Observable:** What colors, type sizes, radii, and shadows are actually used?

**L2 — Structural:** Do they form a consistent system, or are there one-off values?

**L3 — Principle:** Does the palette follow the project's identity (e.g., quiet confidence, neutral-first, single accent)? Do values map to `tokens.css`?

**Common failures:**
- `--md-sys-color-*` or hardcoded hex in CSS.
- 11px/13px/15px font sizes outside the scale.
- One-off 5px or 7px border-radius.
- Heavy shadows on every card, flattening the hierarchy.

### 4. Layout & Responsive

> *Does the layout adapt without breaking, hiding, or overflowing?*

**L1 — Observable:** What happens at 320px, 768px, and 1280px?

**L2 — Structural:** Does the reflow keep the hierarchy and task order?

**L3 — Principle:** Is it mobile-first? Do breakpoints match `STANDARD.md` §9? Does whitespace serve a purpose?

**Common failures:**
- Two-column layout becomes unusable on mobile.
- Fixed-width cards that overflow their container.
- Breakpoints tied to device brands (e.g., `max-width: 414px`) instead of content thresholds.

### 5. Components & States

> *Are the right shared components used, and do they carry every state they need?*

**L1 — Observable:** What interactive elements exist? What states are visible in the screenshot?

**L2 — Structural:** Could a `src/shared/ui/*` component replace a custom element? Does each element expose all needed states?

**L3 — Principle:** Does every interactive element follow the design system's component contract (default, hover, active, focus, disabled, loading, error)? Are touch targets large enough?

**Common failures:**
- Custom `<button>` without focus or disabled styles.
- Toggle without an active state.
- Loading state that hides the label and breaks layout.
- Icon-only button that is pill-shaped instead of circular.

### 6. Motion & Feedback

> *Is motion purposeful, restrained, and accessible?*

**L1 — Observable:** What animates? What is instant?

**L2 — Structural:** Does motion explain a state change or orient the user?

**L3 — Principle:** Are durations and easings from `tokens.css`? Is `prefers-reduced-motion` respected? Are loading, success, and error states communicated without relying only on color?

**Common failures:**
- Motion for motion's sake.
- No reduced-motion fallback.
- Error state only changes border color.
- Transitions so slow they feel broken (>300ms for micro-feedback).

### 7. Accessibility

> *Can the page be used by keyboard, screen reader, low vision, and motion-sensitive users?*

**L1 — Observable:** Is color the only way something is conveyed? Are labels visible?

**L2 — Structural:** Is the focus order logical? Are targets large and well-spaced?

**L3 — Principle:** Does it pass WCAG 2.2 AA (`STANDARD.md` §10.1)? Does it respect `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more`?

**Common failures:**
- Placeholder used as label.
- Icon-only button without `aria-label`.
- Custom control not keyboard-focusable.
- Contrast below WCAG 2.2 AA.

### 8. Craft & Polish

> *Are the invisible details right?*

**L1 — Observable:** Is anything misaligned, cropped, or pixel-hugging?

**L2 — Structural:** Do baselines, grids, and spacing form a consistent rhythm?

**L3 — Principle:** Are all values from tokens? Do icons come from `ICON_CATALOG`? Is there a consistent pattern for empty, loading, and error states?

**Common failures:**
- 1px misalignment between cards.
- Inline SVG copied instead of using the catalog.
- Loading spinner not centered.
- Typography not sitting on a consistent baseline.

### 9. SSOT & Maintainability

> *If I fix this, how many files should change?*

**L1 — Observable:** Where is the value defined? Is it hardcoded?

**L2 — Structural:** Is the pattern duplicated elsewhere?

**L3 — Principle:** Is the fix in the right place — token, shared component, or page? Does the brief let another agent implement it without guessing?

**Common failures:**
- Same button style copied into three page CSS files.
- Token value changed in one place but hardcoded in another.
- New component added to `src/` without documentation update.

---

## Question Bank

Use these questions whenever the audit stalls.

### Reframing
- What is the user trying to do, and what is getting in their way?
- If I remove the current UI, what is the smallest interface that would still work?
- What would a wrong answer look like?
- What is the cheapest test that would prove or disprove this?

### First principles
- If we had no legacy code, what would we build?
- What is the one rule this screen must never break?
- Is this a local fix or a pattern fix?

### Design tension
- What two valid principles are in conflict here?
- Which side are we optimizing for, and what do we give up?
- Would the same trade-off make sense on a different screen?

### Cross-context
- If this method works here, where else can we use it?
- Is the fix reusable, or is it a one-off hack?
- Does it belong in a shared component/token, or in the page?

---

## Decision Pipeline

```text
0. REFRAME → turn the user's feeling into a design question
1. SCOPE    → page, component, viewport, user job
2. READ     → code, DOM, computed styles, tokens, shared UI
3. CLASSIFY → taxonomy above, reuse/extend/create/remove
4. AUDIT    → run every aspect with L1/L2/L3 questions
5. DECIDE   → change / keep / reject, with risk
6. BRIEF    → implementable, verifiable, SSOT-aware
7. VERIFY   → typecheck, build, design-system audit
```

### Step 0 — Reframe

- Capture the user's exact words.
- Translate them into a design question using the reframe table.
- Name the primary job and the user's context (device, age, task).
- State the **Design Read** in one sentence.

**Guard:** You can answer "What is the real question we are trying to answer?" before moving on.

### Step 1 — Scope

- Identify the target: file path, route, component, or URL.
- Decide page kind: landing, app, dashboard, settings, onboarding, player, content.
- Default device context: **mobile-first**. Override only if the project explicitly says desktop-first.
- Produce a **Design Read** in one sentence: e.g., "This is a content-first player page that needs calm hierarchy and clear action affordances."

### Step 2 — Read & Map

- Read the page component, its CSS modules, and parent layout.
- If a browser or MCP is available, inspect DOM and computed styles.
- Draw ASCII wireframes for 320px and 1280px.
- Inventory: functions, states, content, components, tokens, layout, motion.

**Guard:** You can answer:
1. What is the primary user job?
2. How many secondary jobs?
3. What states can the page be in?
4. What is the visual hierarchy at 320px?
5. What changes at 1280px?

### Step 3 — Classify

For every UI element:
- Atomic Design layer: foundation/atom/molecule/organism/template/page.
- Decision: **reuse** `src/shared/ui/*`, **extend** a shared component, **create** a new shared component, or **remove**.
- Flag new tokens or components needed, with rationale.

### Step 4 — Audit

Run all nine aspects above. For each finding, record:

| Aspect | L1/L2/L3 Question | Evidence | Standard | Severity | Current | Proposed | Risk |
|---|---|---|---|---|---|---|---|---|

Stop when you have one P0 or two P1 findings that explain the user's feedback. Do not chase P2/P3 unless the user asks.

**Severity scale:**
- **P0 — Blocker:** breaks function, accessibility, or SSOT. Must fix.
- **P1 — Major:** hurts usability or consistency. Should fix.
- **P2 — Minor:** polish, can defer.
- **P3 — Nice-to-have:** suggestion, not a finding.

### Step 5 — Decide

For each finding, produce:
- **Question:** the L3 question that exposed the issue.
- **Current:** what is wrong, with evidence.
- **Proposed:** what to change, mapped to token/component/standard.
- **Risk:** technical, accessibility, or maintenance risk of the change.
- **Verdict:** change / keep / reject.

Check technical feasibility:
- New dependencies? (prefer none)
- Shadow DOM / extension context safe?
- SSR-safe?
- Respects `prefers-reduced-motion`?
- Respects token file (no hardcode)?

### Step 6 — Brief & Verify

Output a brief with this table:

```markdown
| Finding | Question | Current | Proposed | Risk | Priority | Principle |
|---|---|---|---|---|---|---|
```

Then:
1. Run design-system audit commands from `DESIGN.md` §8.
2. If code was changed, run `npm run typecheck` and `npm run build`.
3. If the audit is a **precursor to designing a component** (not just a page redesign), append a `## Hand-off to idea-to-interface` section.
4. Update `self-evolution/RUNBOOK.md` with one line.

---

## Output Format

Begin with a short **Design Read** that includes the **reframed question**.

Then present findings in priority order. Each finding must contain:

```markdown
### [P0/P1/P2] [Aspect] — [Short title]

**Question:** ... (the L3 question that exposed the issue)

**Current:** ... (with evidence: file line, computed style, token, or screenshot)

**Design tension:** ... (if any)

**Standard:** ... (citation from codebase or external, with reasoning)

**Proposed:** ...

**Risk:** ...

**Verdict:** change / keep / reject
```

End with a concise **Redesign Brief** table and a **SSOT action list**.

If the audit is intended as input for `idea-to-interface`, also append a `## Hand-off to idea-to-interface` section with:

```markdown
## Hand-off to idea-to-interface

**Design Read:** [one line]

**Reframed question:** [one line]

**Top constraints (P0/P1):**
1. [Finding] → [what the new design must solve]
2. [Finding] → [what the new design must solve]

**Non-negotiables:**
- [e.g., must use existing `Button` not custom `<button>`]
- [e.g., touch target ≥ 44px on mobile]
- [e.g., single accent only]

**Starting frame for `idea-to-interface`:**
- Component/pattern scope: ...
- Primary job: ...
- Suggested 3 dials: DESIGN_VARIANCE [?], MOTION_INTENSITY [?], VISUAL_DENSITY [?]
- Suggested starting point in `src/shared/ui/*`: ...
```

---

## Anti-Patterns

| Don't | Why |
|---|---|
| Audit by personal taste only | Without a principle, it is not design critique. |
| Skip the reframe step | You will answer the wrong question and produce a local fix. |
| Ask "is this beautiful?" | Beauty is not measurable. Ask "which principle does it violate?" |
| Treat symptoms as root cause | A red error banner is not the problem; the problem is why the user sees it before acting. |
| Ignore design tension | Most real problems are trade-offs. Pick a side with evidence. |
| Hardcode values in the brief | Every proposal must map to a token or shared component. |
| Skip mobile-first | The default persona is a 10–25-year-old learner on a phone. (`AGENTS.md` personas) |
| Ignore `prefers-reduced-motion` | Accessibility is not optional. |
| Add motion to feel "premium" | Motion is a risk, not a feature. |
| Copy a reference 1:1 | References teach principles, not output. |
| Propose changes that violate SSOT | If one change requires editing five files, the fix is in the wrong place. |
| Rely only on image vision | Use DOM, computed styles, and code; vision is optional context only. |

---

## Common Rationalizations

| User says | Respond with |
|---|---|
| "Just make it look better" | "Better for whom, doing what, on which screen? What is the one principle it breaks?" |
| "I don't like it" | "Which aspect feels off: density, color, hierarchy, motion, or layout? I'll reframe it into a question." |
| "Make it like YouTube" | "Which specific feeling: pill controls, dark glass, or timeline behavior? I'll trace it to our tokens or propose a new one." |
| "Use blue and green" | "Which is dominant, which is accent, and what neutral ties them? Does it compete with our single-accent rule?" |
| "This page is special" | "Which part of the design system does it legitimately diverge from, and why?" |

---

## Verification Checklist

- [ ] User complaint reframed into a design question.
- [ ] Design Read declared with evidence.
- [ ] Page, component, and design system located.
- [ ] ASCII wireframes for 320px and 1280px.
- [ ] All nine aspects audited with L1/L2/L3 questions; skipped aspects marked N/A.
- [ ] At least one design tension named and resolved.
- [ ] Every finding tied to a named principle and severity.
- [ ] Every proposal mapped to token, component, or codebase standard.
- [ ] Internet/external sources used only with reasoning.
- [ ] SSOT check done: no duplicate patterns, no hardcode where token exists.
- [ ] Build / typecheck pass (if code changed).
- [ ] `self-evolution/RUNBOOK.md` updated.
- [ ] If this is a component/pattern audit, a `## Hand-off to idea-to-interface` section is appended.

---

## Self-Evolution

After every run — audit, brief, or implementation — append one line to `self-evolution/RUNBOOK.md`.

When `RUNBOOK.md` has 5+ entries or a test case fails, run `self-evolution/workflow.md`.

---

## Router Boomerang

- Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route.
- If the user starts with a **raw idea** and no target → use `idea-to-interface`.
- If the user has an **audit brief** and is ready to design the fix → hand off to `idea-to-interface` with the `## Hand-off to idea-to-interface` section.
- If the audit reveals the target is a single component and the user wants a detailed design → `idea-to-interface` is the next skill.
- If the audit reveals the target is a full page or complex flow → stay in this skill or hand off to `frontend-ui-engineering` after the brief.
