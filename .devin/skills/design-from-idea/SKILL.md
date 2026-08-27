---
name: design-from-idea
description: Run a Socratic pipeline that turns a vague UI idea into a concrete component design, grounded in the project design system context and optionally an audit brief. Use when the user has an inspiration, concept, or partial requirement and needs to decide what to build, how it looks, and which design tokens or components to use. Not for writing implementation code, debugging existing code, or auditing finished UI.
---

# Design from Idea — Socratic Component Design Pipeline

## Overview

This skill treats design knowledge as perishable. The answer that worked yesterday may not fit today's context. So the workflow does not dump a checklist; it asks questions until the design reveals itself from the user's own constraints.

The output is a **component design brief** the agent can hand to `design-taste-frontend`, `m3-design-standard`, or implementation skills.

The skill first ingests `docs/context/project-context.md` (and the design system it references) so it can propose concrete design decisions without asking the user for context the project already defines.

> **If the idea comes from an `audit-ui-ux-then-redesign` brief, that brief is not optional context — it is the top-level constraint.** The audit output becomes the input of this skill.

## When to Use

- The user says "I want a component that..." or "I have an idea for...".
- The inspiration is sensory: color, texture, mood, nature, sound, movement.
- The scope is one component or one small pattern, not a full page or redesign.
- The user wants help translating a vague feeling into design decisions.
- The user has an **audit brief** from `audit-ui-ux-then-redesign` and is ready to design the fix.

## When NOT to Use

- The spec already exists and the task is to implement code.
- The task is debugging, testing, or performance tuning.
- The user asks for a design system audit or review of existing UI → use `audit-ui-ux-then-redesign`.
- The output must be a coded component (hand off to `frontend-ui-engineering` instead).

## The Socratic Pipeline

### Step 0 — Ingest project context

**Purpose:** Ground every design decision in the project's existing design story, constraints, and components.

**Actions:**
- Read `docs/context/project-context.md` and extract the design story (e.g., liquid glass, nature/water/sun), persona, platform, and constraints.
- Read `src/shared/styles/README.md` and `docs/design-system/DESIGN.md` if available for token/component maps and audit rules.
- Skim `src/shared/styles/tokens.json` and `src/shared/ui/*` to know available tokens and components.
- If the component may touch architecture or shared language, read `docs/1-share-language.md` and `docs/2-architechture-system.md`.
- Summarize: palette, shape language, motion language, density, and any component that covers 80% of the idea.

**Guard:** The agent can state the project's design story and at least two concrete token/component directions in one sentence.

**Loop back:** If `project-context.md` is missing or the design story is empty, invoke `interview-me` or `elicitation` to extract it before continuing.

---

### Step 0.5 — Ingest audit brief (if any)

> **Output of `audit-ui-ux-then-redesign` becomes input of `design-from-idea`.**

**Purpose:** If the idea comes from an audit of an existing page or component, treat every finding as a design constraint, not as background.

**Actions:**
- Ask: "Do you have an audit brief from `audit-ui-ux-then-redesign` for this component or page?"
- If the user provides a brief (a markdown file, a findings table, or pasted text), read it.
- Extract: P0/P1 findings, Current → Proposed → Risk rows, SSOT action list, and the Redesign Brief table.
- For each finding, decide whether this design must **solve the root cause**, **avoid the symptom**, or **honor the proposed change**.
- If the brief contains a "Hand-off to `design-from-idea`" section, use it as the starting frame.
- If no audit brief exists, ask: "Is this idea fixing an existing UI problem, or is it a brand-new component/pattern?" If it is fixing something, stop and invoke `audit-ui-ux-then-redesign` first.

**Guard:** The agent can state:
1. Whether an audit brief is present.
2. The top two constraints from the brief (or "none — net-new idea").
3. How the design will address each P0/P1 finding.

**Loop back:** If the user has an audit brief but has not read it, read it before Step 1. If the idea is a fix for existing UI and no audit exists, invoke `audit-ui-ux-then-redesign`.

---

### Step 1 — Anchor the idea

**Purpose:** Capture the raw inspiration without losing it.

**Actions:**
- Ask: "What is the one word or one image that sums up this idea?"
- Ask: "What should the user feel when they see this component?"
- Compare the answer to the project design story from Step 0 and surface any mismatch (e.g., "the project palette leans ocean/sun; does this idea need a different color?").
- If an audit brief exists, compare the inspiration to the audit's "Design Read" and flag conflicts (e.g., "the audit says the page needs less motion; does this idea conflict?").
- Ask: "What would make this component feel out of place in your product?"

**Guard:** The user can name at least one concrete feeling or one visual reference.

**Loop back:** If the idea is still abstract, ask for a real object, scene, or product that has the same mood, or invoke `interview-me` / `elicitation`.

---

### Step 2 — Define the job

**Purpose:** Turn mood into function.

**Actions:**
- Ask: "What does this component help the user do?"
- Ask: "What is the primary action or primary piece of information?"
- Ask: "If this component succeeds, what changes for the user?"
- If an audit brief exists, ask: "Which audit finding does this component directly solve?"

**Guard:** The user can state the component's single primary job in one sentence.

**Loop back:** If the component has more than one primary job, list the user's possible jobs and ask them to pick one, or split the idea into multiple components.

---

### Step 3 — Map to the design system

**Purpose:** Decide whether to reuse, extend, or create — using the project context, not the user's memory.

**Actions:**
- Use Step 0 context: list existing `src/shared/ui/*` components that cover 80% of the idea and how to compose them.
- If an audit brief exists from Step 0.5, map each finding to a design decision:
  - Reuse/extend/create for P0 findings: the design **must** solve them.
  - For P1 findings: decide which to solve now, which to defer, and document the reason.
  - For P2/P3 findings: consider as polish or intentionally reject with a one-line rationale.
- List the token groups the component must touch: color, typography, spacing, radius, elevation, motion.
- Decide what must stay inside the existing token set and what might need a new token, based on `tokens.json` patterns.
- Only ask the user a focused question if the context is genuinely ambiguous (e.g., two equally valid token choices).

**Guard:** The agent can name at least one existing component or one token group, and justify the choice with a context quote.

**Loop back:** If the design system is still unknown after Step 0, run `skill:design-system-guardian` or read `docs/design-system/DESIGN.md`.

---

### Step 4 — Choose the visual expression

**Purpose:** Translate inspiration into visual decisions that fit the project design story.

**Actions:**
- Use the palette and shape/motion language from Step 0 to propose the dominant 1–3 colors.
- Propose shape (sharp, soft, pill, organic, absent) and motion (instant, gentle spring, slow fade, none) based on the project's liquid-glass / nature / water / sun story.
- Ask the user to confirm or adjust, rather than asking from a blank slate.
- Set the three dials `DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` on a 1–10 scale and explain the default with a context quote.
- If an audit brief exists, do not let the dials override P0 findings (e.g., if audit says motion is too heavy, cap `MOTION_INTENSITY` ≤ 3).

**Guard:** The user can set three dials or explicitly accept the proposed defaults.

**Loop back:** If the visual direction conflicts with the design system, surface the conflict, propose a resolution, and only ask if both options are equally valid.

---

### Step 5 — Design the states

**Purpose:** Make the component feel alive, not static.

**Actions:**
- Ask: "What does default, hover, focused, pressed, disabled, loading, and error look like?"
- Ask: "Which states are required now, and which can come later?"
- Map each state to a `src/shared/ui/*` variant or token where possible (e.g., `Button` `loading`, `disabled`, `error`; `Tabs` `active`; `Input` `error`).

**Guard:** The user has identified at least default + hover + focus.

**Loop back:** If states are too many, ask which state would break the user flow if missing.

---

### Step 6 — Define responsive behavior

**Purpose:** Ensure the component survives all screens.

**Actions:**
- Use the platform constraints from Step 0 (desktop, tablet, Android, RAM ≥1GB, response <3s) to propose default breakpoints.
- Ask: "At 320px, what stays, what hides, what stacks?"
- Ask: "At 1280px, does the component grow, center, or break into multiple columns?"
- Ask: "What is the minimum touch target and the maximum comfortable width?"
- If an audit brief mentions responsive/overflow issues, list them as constraints for 320px and 1280px.

**Guard:** The user can describe the 320 and 1280 behavior in one sentence each.

**Loop back:** If the component cannot shrink without losing its job, reconsider the component scope.

---

### Step 7 — Write the brief

**Purpose:** Produce a hand-off artifact grounded in the project context.

**Actions:**
- Emit a brief with: Design Read, 3 dials, color/token mapping, typography roles, layout, states, responsive behavior, component reuse plan, anti-patterns, and **audit findings addressed**.
- If an audit brief exists, append a section `## Findings from audit-ui-ux-then-redesign` that maps each P0/P1 finding to a design decision in this brief.
- Include at least one quote from `docs/context/project-context.md` (persona, palette, platform, or constraint) that justifies a design choice.
- Ask: "Does this brief still match your original inspiration and solve the audit findings (if any)?"

**Guard:** The user confirms the brief matches the feeling from Step 1.

**Loop back:** If the brief feels generic, ask the user to replace any vague word with a concrete one.

## Anti-Patterns

| Don't | Why |
|---|---|
| Start designing before reading `docs/context/project-context.md` | The project already owns the design story; asking the user repeats work and risks drift. |
| Start from tokens | Tokens encode decisions; they are not the starting point. |
| Copy a reference 1:1 | References teach principles, not output. |
| Skip the "one primary job" | Components with two primary jobs become confusing. |
| Ask "what do you want it to look like?" first | Form follows function and feeling; starting with form produces generic UI. |
| Dump a checklist | Stored knowledge is stale; questions surface the answer for this context. |
| Design without existing tokens in mind | This creates drift and hardcode. |
| Ignore an existing `audit-ui-ux-then-redesign` brief | Audit findings are constraints, not optional context. Re-designing over them repeats the same mistakes. |

## Common Rationalizations

| If the user says... | Respond with... |
|---|---|
| "Just make it look nice" | "Nice for whom, doing what, on which screen?" |
| "Like Material Design" | "Which principle of Material: color, elevation, motion, or layout?" |
| "I want it minimal" | "Minimal means removing something. What should this component not do?" |
| "Copy YouTube" | "What specific feeling in YouTube do you want, and what must we change to fit Cell?" |
| "Use blue and green" | "Which is dominant, which is accent, and what neutral ties them together?" |
| "I don't know the design system" | "The project context and `src/shared/styles/README.md` already define it. Let's read those first." |
| "I want to fix this button" | "Do you have an audit brief, or should we run `audit-ui-ux-then-redesign` first?" |

## Templates

### Component design brief template

```markdown
## Design Read
[one line]

## 3 Dials
- DESIGN_VARIANCE: [1-10]
- MOTION_INTENSITY: [1-10]
- VISUAL_DENSITY: [1-10]

## Inspiration anchor
[one word or image]

## Primary job
[one sentence]

## Context quote
[one sentence from `docs/context/project-context.md` that justifies a design choice]

## Token mapping
- color: ...
- typography: ...
- spacing: ...
- radius: ...
- elevation: ...
- motion: ...

## Layout
- 320px: ...
- 768px: ...
- 1280px: ...
- 1920px: ...

## States
- default: ...
- hover: ...
- focus: ...
- pressed: ...
- disabled: ...
- loading: ...
- error: ...

## Component reuse
- existing: ...
- new: ...
- snowflake: ...

## Findings from audit-ui-ux-then-redesign (if any)
| Finding | How this brief addresses it | Verdict |
|---|---|---|
| [P0] ... | ... | solve / defer / reject |
| [P1] ... | ... | solve / defer / reject |

## Anti-patterns
- ...
```

### Socratic opening question bank

```text
1. What should the user feel in the first 3 seconds?
2. What is the one thing this component must not fail at?
3. If you removed all decoration, what would still make it work?
4. Which existing product gives you the same mood?
5. What would make this component feel wrong in your app?
6. What is the cheapest version that still delivers the feeling?
7. Are you fixing an existing UI problem? If so, do you have an audit brief?
```

## Verification

- [ ] `docs/context/project-context.md` and design system files were read before asking design questions.
- [ ] If an audit brief exists, it was read and its findings were mapped to design decisions.
- [ ] The user named a concrete feeling or visual reference.
- [ ] The component has one primary job.
- [ ] At least one existing component or token group was considered, with a context quote.
- [ ] Three dials were set or defaulted, with a context quote for the default.
- [ ] Default, hover, and focus states are defined.
- [ ] 320 and 1280 behavior are described.
- [ ] The final brief includes a Design Read, token mapping, layout, states, component reuse, audit findings (if any), context quote, and anti-patterns.
- [ ] The user confirmed the brief still matches the original inspiration and solves the audit findings (if any).

## Router boomerang

- Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route.
- If the user is describing a problem with **existing UI** → use `audit-ui-ux-then-redesign` first, then return here.
- If the user has an audit brief and is ready to design the fix → stay in this skill and start at Step 0.5.
