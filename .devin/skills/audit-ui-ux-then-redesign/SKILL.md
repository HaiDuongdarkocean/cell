---
name: audit-ui-ux-then-redesign
description: Audit any UI page or component like a senior product designer — with taxonomy, evidence, and reasoning. Use when a page feels off, before a redesign, or when validating a design system decision. Not for logic bugs, backend, or brand-new ideas without a target.
---

# Audit UI/UX then Redesign

> **A redesign brief is only as good as the critique that produces it.**

This skill turns a page or component into a **conditional, evidence-based redesign brief**. It behaves like an opinionated senior product designer: it classifies, questions, compares, and argues — then proposes only the changes that survive scrutiny.

It does not settle for vague feelings. It asks *why* something feels off, cites the principle, and traces the symptom back to a root cause.

## When to Use

- The user says a page is "off", "doesn't fit", or "looks wrong".
- You are about to redesign a page, component, or flow.
- You want to validate whether a new UI matches the project's design system.
- You need a redesign brief before implementation.

## When NOT to Use

- Fixing a logic bug or runtime error → use `debugging-and-error-recovery`.
- Building from a raw idea with no target page → use `design-from-idea`.
- No design system, no tokens, no shared components, and no user context.
- Pure content/copy task with no visual or interaction change.

---

## Core Principle

> **Audit for root cause, not preference.**

A senior designer does not say "I don't like the blue". They say:
> "The blue competes with the primary accent because both sit at the same luminance and saturation. This breaks the neutral-first rule and weakens the hierarchy."

Every finding in this skill must:
1. Name the **aspect** (taxonomy).
2. Ask the **right question**.
3. Provide **evidence** (DOM, computed style, token, screenshot, or reference).
4. Cite a **standard** (codebase or external, with reasoning).
5. Propose a **change/keep/reject** with risk.

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

Use these nine aspects as the skeleton of every audit. Do not skip an aspect because it feels irrelevant — classify it as "not applicable" with one sentence.

### 1. Strategy & Purpose

> *Why does this page exist? Who is it for? What is the one primary job?*

**Questions:**
- What is the primary user job on this page?
- How many secondary jobs exist? Are they truly secondary or competing?
- Does the visual hierarchy match the job priority?
- Is there a clear entry point, progress path, and exit/confirmation?

**Common failures:**
- Multiple primary CTAs fighting for attention.
- Marketing copy obscuring functional controls.
- Page tries to serve two personas with opposite needs.

### 2. Information Architecture

> *How is content grouped, labeled, and sequenced?*

**Questions:**
- Are related items close together (Gestalt proximity)?
- Are labels consistent with the project's shared language (`docs/1-share-language.md`)?
- Is the reading order natural at 320px and 1280px?
- Are empty, loading, and error states designed, not afterthoughts?

**Common failures:**
- Form fields scattered across unrelated cards.
- No empty state or generic "No data" without next step.
- Important metadata buried below the fold on mobile.

### 3. Visual System

> *Color, typography, spacing, shape, elevation — are they singing the same song?*

**Questions:**
- Are colors taken from `tokens.css` (`--color-*`), or hardcoded?
- Is the palette neutral-first with a single accent, or are there multiple accents competing?
- Does typography stay within the type scale (`--font-size-*`, `--font-weight-*`, `--leading-*`, `--tracking-*`)?
- Is spacing from the 4px token scale (`--space-*`)?
- Are radii from the radius scale (`--radius-*`)?
- Do shadows match the elevation scale (`--shadow-*`) and serve a hierarchy purpose?

**Common failures:**
- `--md-sys-color-*` or hardcoded hex in CSS.
- 11px/13px/15px font sizes outside the scale.
- One-off 5px or 7px border-radius.
- Heavy shadows on every card, flattening the hierarchy.

### 4. Layout & Responsive

> *Does the layout adapt without breaking, hiding, or overflowing?*

**Questions:**
- Is it mobile-first? (Design for 320px, then 768px, then 1280px.)
- At 320px, is anything cut off, overlapping, or requiring horizontal scroll?
- At 1280px, is whitespace purposeful or accidental?
- Do breakpoints match `STANDARD.md` §9 (compact <600, medium 600–839, expanded 840–1199, large 1200–1599, extra-large ≥1600)?
- Are media queries in CSS using hardcoded `px` values (required) or `var(--breakpoint-*)` (forbidden)?
- Does content reflow gracefully under zoom and text-size changes?

**Common failures:**
- Two-column layout becomes unusable on mobile.
- Fixed-width cards that overflow their container.
- Breakpoints tied to device brands (e.g., `max-width: 414px`) instead of content thresholds.

### 5. Components & States

> *Are the right shared components used, and do they carry every state they need?*

**Questions:**
- Could a `src/shared/ui/*` component replace a custom element?
- If a custom element is necessary, does it justify its existence?
- Does every interactive element have: default, hover, active/pressed, focus-visible, disabled, loading, error, and (if togglable) on/off states?
- Are focus rings visible and consistent?
- Do buttons have enough touch target (mobile 44px, desktop 40px)?
- Is an `IconButton` used when only an icon is needed, or is a `Button` being misused?

**Common failures:**
- Custom `<button>` without focus or disabled styles.
- Toggle without an active state.
- Loading state that hides the label and breaks layout.
- Icon-only button that is pill-shaped instead of circular.

### 6. Motion & Feedback

> *Is motion purposeful, restrained, and accessible?*

**Questions:**
- Does every animation solve a problem (orientation, state change, delight with restraint)?
- Do durations and easings come from `tokens.css` (`--duration-*`, `--ease-*`)?
- Is `prefers-reduced-motion` respected?
- Are loading, success, and error states communicated without relying only on color?

**Common failures:**
- Motion for motion's sake.
- No reduced-motion fallback.
- Error state only changes border color.
- Transitions so slow they feel broken (>300ms for micro-feedback).

### 7. Accessibility

> *Can the page be used by keyboard, screen reader, low vision, and motion-sensitive users?*

**Questions:**
- Does color alone convey meaning? (It should not.)
- Are normal text contrast ratios ≥ 4.5:1 and large text ≥ 3:1? (`STANDARD.md` §10.1)
- Is the focus order logical and visible?
- Are ARIA labels, roles, and states correct?
- Are interactive targets large enough and well-spaced?
- Does it pass `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more`?

**Common failures:**
- Placeholder used as label.
- Icon-only button without `aria-label`.
- Custom control not keyboard-focusable.
- Contrast below WCAG 2.2 AA.

### 8. Craft & Polish

> *Are the invisible details right?*

**Questions:**
- Is everything aligned to the 4px baseline or the project's grid?
- Do text baselines line up across adjacent elements?
- Are there awkward half-pixel gaps or double borders?
- Do hover/active states feel responsive, not delayed?
- Is there a consistent pattern for empty, loading, and error placeholders?
- Do icons come from `ICON_CATALOG` and follow 24×24, 1.5px stroke, `currentColor`?

**Common failures:**
- 1px misalignment between cards.
- Inline SVG copied instead of using the catalog.
- Loading spinner not centered.
- Typography not sitting on a consistent baseline.

### 9. SSOT & Maintainability

> *If I fix this, how many files should change?*

**Questions:**
- Are values pulled from `tokens.css` or hardcoded?
- Are shared UI components used, or is the page reimplementing its own?
- Is the same visual pattern duplicated in multiple files?
- Does the page update `docs/2-architechture-system.md` and `docs/0-wiki.md` when structure changes? (per `AGENTS.md`)
- Is the design brief written in a way another agent can implement without guessing?

**Common failures:**
- Same button style copied into three page CSS files.
- Token value changed in one place but hardcoded in another.
- New component added to `src/` without documentation update.

---

## Decision Pipeline

```text
1. SCOPE    → page, component, viewport, user job
2. READ     → code, DOM, computed styles, tokens, shared UI
3. CLASSIFY → taxonomy above, reuse/extend/create/remove
4. AUDIT    → run every aspect, evidence first
5. DECIDE   → change / keep / reject, with risk
6. BRIEF    → implementable, verifiable, SSOT-aware
```

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

| Aspect | Question | Evidence | Standard | Severity | Current | Proposed | Risk |
|---|---|---|---|---|---|---|---|

Stop when you have one P0 or two P1 findings that explain the user's feedback. Do not chase P2/P3 unless the user asks.

**Severity scale:**
- **P0 — Blocker:** breaks function, accessibility, or SSOT. Must fix.
- **P1 — Major:** hurts usability or consistency. Should fix.
- **P2 — Minor:** polish, can defer.
- **P3 — Nice-to-have:** suggestion, not a finding.

### Step 5 — Decide

For each finding, produce:
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
| Finding | Current | Proposed | Risk | Priority | Principle |
|---|---|---|---|---|---|
```

Then:
1. Run design-system audit commands from `DESIGN.md` §8.
2. If code was changed, run `npm run typecheck` and `npm run build`.
3. Update `self-evolution/RUNBOOK.md` with one line.

---

## Output Format

Begin with a short **Design Read**.

Then present findings in priority order. Each finding must contain:

```markdown
### [P0/P1/P2] [Aspect] — [Short title]

**Current:** ... (with evidence: file line, computed style, token, or screenshot)

**Question from taxonomy:** ...

**Standard:** ... (citation from codebase or external, with reasoning)

**Proposed:** ...

**Risk:** ...

**Verdict:** change / keep / reject
```

End with a concise **Redesign Brief** table and a **SSOT action list**.

---

## Anti-Patterns

| Don't | Why |
|---|---|
| Audit by personal taste only | Without a principle, it is not design critique. |
| Hardcode values in the brief | Every proposal must map to a token or shared component. |
| Skip mobile-first | The default persona is a 10–25-year-old learner on a phone. (`AGENTS.md` personas) |
| Ignore `prefers-reduced-motion` | Accessibility is not optional. |
| Add motion to feel "premium" | Motion is a risk, not a feature. |
| Copy a reference 1:1 | References teach principles, not output. |
| Propose changes that violate SSOT | If one change requires editing five files, the fix is in the wrong place. |
| Ask open-ended questions | Use binary or one-choice questions. |
| Rely only on image vision | Use DOM, computed styles, and code; vision is optional context only. |

---

## Common Rationalizations

| User says | Respond with |
|---|---|
| "Just make it look better" | "Better for whom, doing what, on which screen?" |
| "I don't like it" | "Which aspect feels off: density, color, hierarchy, motion, or layout?" |
| "Make it like YouTube" | "Which specific feeling: pill controls, dark glass, or timeline behavior? I'll trace it to our tokens or propose a new one." |
| "Use blue and green" | "Which is dominant, which is accent, and what neutral ties them?" |
| "This page is special" | "Which part of the design system does it legitimately diverge from, and why?" |

---

## Verification Checklist

- [ ] Page, component, and design system located.
- [ ] Design Read declared with evidence.
- [ ] ASCII wireframes for 320px and 1280px.
- [ ] All nine aspects audited; each skipped aspect marked N/A.
- [ ] Every finding tied to a named principle and severity.
- [ ] Every proposal mapped to token, component, or codebase standard.
- [ ] Internet/external sources used only with reasoning.
- [ ] SSOT check done: no duplicate patterns, no hardcode where token exists.
- [ ] Build / typecheck pass (if code changed).
- [ ] `self-evolution/RUNBOOK.md` updated.

---

## Self-Evolution

After every run — audit, brief, or implementation — append one line to `self-evolution/RUNBOOK.md`.

When `RUNBOOK.md` has 5+ entries or a test case fails, run `self-evolution/workflow.md`.

---

## Router Boomerang

Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route.
