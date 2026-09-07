---
name: idea-to-interface
description: Transform a raw or confirmed UI idea into three Socratic-grounded concepts and an interactive mockup site, then map the chosen concept to the project's component system. Use when the user has an inspiration, a redesign need, or a confirmed intent and wants real alternatives before implementing. Not for debugging, already-fixed designs, or pure audits.
---

# Idea-to-Interface

> Take a raw or confirmed idea → question it Socratically → generate three distinct concepts → build a live mockup site with a real panel and variants → map the chosen one to components.

## When to use

- The user says "I want a component that...", "làm sao để user tương tác với tính năng X?", or "redesign this panel".
- A `docs/intent/[topic].md` or `docs/specs/[topic].md` exists with business / user journey confirmed.
- The user wants to see real alternatives and pick one before code is written.
- The redesign needs a side-by-side comparison with the **shipped production UI**.

## When NOT to use

- The design is already fixed → implement directly with `frontend-ui-engineering`.
- No intent / spec exists and the user cannot articulate the need → use `interview-me`, `elicitation`, or `inquiry-creativity` first.
- The task is a pure audit of existing UI → use `audit-ui-ux-then-redesign` first, then return here.
- The task is debugging, testing, or performance tuning.

---

## Core principles

> **Design from function and feeling, not from inventory.**
>
> The first phase is *ideation*: forget the component library and ask what the best UI is for this behavior and feeling.
> The second phase is *mapping*: reconcile the ideal UI with the design system, tokens, and codebase reality.
>
> The design chain is: **audit function → map user journey → shape IA → craft UX/UI**.
> A concept is not a new coat of paint. A concept is a different answer to the same user journey.

> **Diverge visually before you wireframe.**
>
> Before any mockup is built, each concept must own a distinct **visual archetype** (e.g. solid editorial, dashboard bento, mechanical ledger).
> Three concepts must feel like three different products, not three skins of the same product.

> **Mobile-first by default.**
>
> Start at the narrowest practical viewport (320–420 px), then enhance for desktop. Every concept must answer:
> - Will it fit a 375 px header?
> - Are touch targets ≥ 44 × 44 px?
> - Does the advanced menu become a bottom sheet / full-width action on mobile?
> - Is the thumb zone respected?

> **Mockups are decision tools, not artboards.**
>
> Every mockup must include the **real production panel**, theme switching, viewport switching, and at least three concept variants. The goal is to let the user feel the difference, not to decorate.

---

## Step 0 — Load context

**Purpose:** Ground every design decision in the project's existing story, constraints, and components.

**Actions:**
1. Read `docs/context/project-context.md` and extract the design story (palette, shape, motion, persona, platform, constraints).
2. Read `docs/design-system/DESIGN.md` and `src/shared/styles/README.md` for tokens and audit rules.
3. Read `src/shared/styles/tokens.json` to know the color, spacing, radius, shadow, and motion vocabulary. **Do not read `src/shared/ui/*` yet.** Component inventory is deliberately deferred to Step 8 so ideation is not anchored on existing components.
4. If the topic touches shared language or architecture, read `docs/1-share-language.md` and `docs/2-architecture-system.md`.
5. If an `audit-ui-ux-then-redesign` brief exists, read it and treat every P0/P1 finding as a hard constraint.
6. Read the existing related feature code (`src/features/[topic]/*`, the real panel, related hooks) to understand the *function*, not the UI.
7. **Do not use or reference Liquid Glass.** Cell no longer designs new UI with Liquid Glass. Avoid `Card variant='glass'`, `Button material='liquid'`, `Input variant='glass'`, and any `color-glass-*` / `blur-*` / `backdrop-filter` tokens. Use solid/filled surfaces and standard tokens (`--color-surface`, `--color-surface-hover`, `--color-primary`, etc.).

**Guard:** The agent can state in one sentence:
- The design story and one concrete feeling the concept should evoke.
- The one core action and the one core decision the user must make.
- One existing component or token that covers at least 60% of the idea.
- The top two constraints from any audit brief (or "none — net-new idea").

**Loop back:** If `project-context.md` or the design story is missing, invoke `interview-me` or `elicitation` to extract it before continuing. Nếu `project-context.md` đã có design story (palette, cảm giác, phong cách), dùng nó làm SSOT — không hỏi user lại về style.

---

## Step 1 — Anchor the idea

**Purpose:** Capture the raw inspiration without losing it.

**Actions:**
- Ask: "What is the one word or one image that sums up this idea?" — only if `project-context.md` does not already state a design story.
- Derive the feeling from `project-context.md` (palette, cảm giác, phong cách). Only ask the user to confirm or flag a mismatch, not to restate the design style.
- Capture a **non-digital reference** (a real object, scene, material, or product) that has the same mood, e.g. *tủ sách cá nhân*, *bento box*, *sổ cái*, *bảng điều khiển*. Also collect one visual reference (app, site, photo) if the user provides one.
- Ask: "What is the cheapest version that still delivers that feeling?"
- Compare the answer to the project design story and surface mismatches.
- If an audit brief exists, compare the inspiration to the audit's "Design Read" and flag conflicts.
- Ask: "What would make this UI feel out of place in your product?"

**Guard:** The user names at least one concrete feeling, one non-digital reference, one visual reference (if available), and one primary job in one sentence.

**Loop back:** If the idea is still abstract, ask for a real object, scene, or product with the same mood, or invoke `interview-me` / `elicitation`.

---

## Step 1.5 — Audit the function

**Purpose:** Know what the UI must do before deciding how it looks.

**Actions:**
1. List every function in the target from:
   - the real production component,
   - any `docs/intent/[topic].md` or `docs/specs/[topic].md`,
   - any `audit-ui-ux-then-redesign` brief,
   - the user's screenshot or description.
2. Classify each function in this table:

   | Function | Class | Why |
   |---|---|---|
   | ... | `must-have` / `nice-to-have` / `remove` / `merge` | one-line reason |

3. Identify the **one primary job** the user is trying to complete. If there is more than one, ask the user to pick one or split into separate tasks.
4. Surface every P0/P1 audit finding as a hard constraint the concept must solve.
5. Capture the **frequency** and **risk** of each function (e.g. "import is done once a week; delete all is rare but dangerous").

**Guard:** The agent can state in one sentence:
- The one primary job.
- The three most important must-have functions.
- The one out-of-scope or merge candidate.

**Loop back:** If the function list is incomplete or the primary job is unclear, ask the user for the exact task they are doing when they open this panel.

---

## Step 1.6 — Map the user journey

**Purpose:** Turn functions into a chronological story before shaping IA.

**Actions:**
1. Build a table with at least these columns:

   | # | Step | User action | System response | UI location |
   |---|---|---|---|---|

2. The journey must have a clear **begin**, **middle**, and **end**.
3. Add an **edge cases** row for: empty state, loading, error, first-time, and one uncommon but risky path.
4. Mark the **moments of uncertainty** — where the user might pause, backtrack, or make a mistake.
5. Check that the journey matches the primary job from Step 1.5. If it does not, fix the primary job or the journey.

**Guard:** The agent can state:
- The first thing the user does.
- The last thing the user does.
- The one edge case that changes the layout the most.

**Loop back:** If the journey is missing steps or is feature-driven ("tab A, tab B") instead of action-driven ("I want to..."), rewrite it.

---

## Step 2 — Define the job and the dials

**Purpose:** Turn mood, function, and journey into measurable design parameters.

**Actions:**
- Confirm the **one primary job** from Step 1.5 and check it against the journey in Step 1.6.
- List **must-haves** from the function audit and the intent (e.g., "both Media and Text can be active at the same time").
- Note **out-of-scope** or deferred decisions.
- Set the three dials. These are *baseline* values; each concept will then push at least one dial in a different direction:
  - `DESIGN_VARIANCE` (1–10): how far from the current UI this concept pushes.
  - `MOTION_INTENSITY` (1–10): how much animation and transition the concept uses.
  - `VISUAL_DENSITY` (1–10): how compact or airy the concept is.
- Propose three **style families** (visual archetypes) for the three concepts before moving on. They must be different non-digital references or style directions, e.g.:
  - *solid editorial* (paper, notebook, calm hierarchy)
  - *dashboard bento* (tiled, glanceable, dense)
  - *command deck* (tools, dials, mechanical, controlled)
- If an audit brief exists, cap the dials according to findings (e.g., if audit says motion is too heavy, `MOTION_INTENSITY` ≤ 3).
- Describe the responsive behavior at **320 px** and **1280 px** in one sentence each.

**Guard:** The agent can state the primary job, the three baseline dial values, the 320/1280 behavior, and three distinct style families.

**Loop back:** If the component has more than one primary job, list the possible jobs and ask the user to pick one, or split into multiple UI tasks.

---

## Step 3 — Generate three unconstrained concepts

**Purpose:** Explore the solution space with both IA and visual divergence before committing.

### 3.1 — Diverge on IA mental models

For the same user journey, invent three different mental models. They must change *what the user thinks the UI is*, not just how it is styled.

Examples:
- **List / shelf:** "Một dãy quyển sách có thể sắp, bật, xóa."
- **Dashboard / bento:** "Một bảng các ô tile, mỗi ô là một vùng tài nguyên."
- **Command deck / ledger:** "Một bảng điều khiển có chương, lệnh, và chỉ số ở dưới."

### 3.2 — Diverge on visual archetypes

Map each IA model to a distinct **visual archetype** from the non-digital references collected in Step 1. The three archetypes must be different in:
- surface (solid, layered, paper, metal, dashboard tile, etc.)
- shape (card, row, tile, pill, rule, grid, sheet, etc.)
- typography rhythm (editorial large headings, compact labels, tool readouts)
- motion signature (gentle fade, spring scale, direct snap, stagger, etc.)

### 3.3 — Concept template

For each concept, fill this table:

| Field | What to capture |
|-------|-----------------|
| **Name** | One short, memorable label tied to the archetype. |
| **IA mental model** | How the user thinks about the control (e.g., "master switch reveals children", "direct multi-select", "mode dial"). |
| **Visual archetype** | The style family, e.g. "solid editorial", "dashboard bento", "mechanical ledger". |
| **Non-digital reference** | A real object or scene with the same mood. |
| **Material / surface** | How surfaces behave: solid, filled, layered, paper, tile, etc. |
| **Typography treatment** | Heading scale, weight, label style, and type rhythm. |
| **Motion signature** | How elements enter, change state, and respond to touch. |
| **UX flow** | Step-by-step user actions and system reactions, mapped to the journey from Step 1.6. |
| **UI structure** | Layout, hierarchy, key elements, and why the layout matches the archetype. |
| **3 dials** | DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY values; note which dial is pushed. |
| **States** | default, hover, focus, pressed, active, disabled, loading, empty, error. |
| **Why it fits** | Mapping back to the function audit, user journey, intent, and design story. |
| **Risk** | Why it might fail (complexity, discoverability, accessibility, space). |

**Rules for the three concepts:**
- Each concept must have a **different IA mental model, visual archetype, and primary layout pattern**.
- The three concepts must not share the same main container shape or the same interaction family.
- If two concepts can be turned into each other by only changing `border-color`, `background`, or `border-radius`, they are the same concept — delete one.
- One concept is **conservative**, one is a **hybrid**, and one pushes the boundary (**experimental**).
- Concepts can propose new patterns or components if the intent demands them.
- Do not use the same interaction family twice (e.g., do not do three variations of chips, tabs, or bento grids).
- Every concept must solve all P0 audit findings; P1 findings are explicitly solved, deferred, or rejected with a one-line rationale.

**Guard:** The agent can explain in one sentence why each concept is a different *visual language* and a different *IA model*, and how each one solves the primary job and one edge case from the journey.

**Loop back:** If two concepts are the same pattern or the same visual archetype, delete one and invent a different one.

---

## Step 4 — Design the mockup site shell

**Purpose:** Give the user a decision surface where they can compare real UI, not flat screenshots.

**Create the entrypoint:**

```
src/entrypoints/mockup-[topic]/
├── index.html          # Vite HTML entrypoint
├── main.tsx            # shell: concept/viewport/theme switchers + stage
├── real.tsx            # the shipped production component, mounted live
├── ConceptA.tsx        # concept variant A (standalone interactive wireframe)
├── ConceptB.tsx        # concept variant B (standalone interactive wireframe)
├── ConceptC.tsx        # concept variant C (standalone interactive wireframe)
├── mockData.ts         # shared mock state and helpers
├── state.tsx           # shared mock state logic (state only, never UI layout)
└── mockup.css          # shell + concept styles, mobile-first
```

**Concept file isolation rule:**
- `ConceptA.tsx`, `ConceptB.tsx`, and `ConceptC.tsx` must each express their own visual archetype.
- Do **not** create a `common.tsx` that exports shared layout pieces (e.g. `ResourceGroup`, `SectionFrame`) reused by all three concepts. This forces the concepts to look the same.
- `mockData.ts` and `state.tsx` may share data and handlers, but each concept owns its own structure, composition, and style.

**The shell must contain these controls, always visible above the stage:**

| Control | Options | Purpose |
|---------|---------|---------|
| **Concept switcher** | Real panel, Concept A, Concept B, Concept C | Compare shipped UI with new directions. |
| **Viewport switcher** | Mobile (≤420 px), Desktop (≥640 px), optional custom width input | Preview responsive behavior without resizing the browser. |
| **Theme switcher** | Light / Dark | Verify the design in both color schemes. |

**Stage requirements:**
- Use `container-type: inline-size` so concepts respond to the stage width, not the window.
- Default the stage to **Mobile** on first load.
- Stage border, surface background, and radius come from project tokens.
- Include a short **concept note** that explains the **IA and visual archetype** of the selected concept.
- A user must be able to tell which concept is selected **without reading the label** — the visual language should be obvious.
- Light/dark theme must switch via `data-theme` or `data-preset` attributes so all tokens update.

**Guard:** The user can open the page, switch Real → Concept A/B/C, switch Mobile ↔ Desktop, and switch Light ↔ Dark without reload.

**Loop back:** If the real production component cannot be mounted in the mockup, fix the mock state wiring; do not skip the real panel.

---

## Step 5 — Build the real panel and the three concept variants

**Purpose:** Make every option feel real and comparable.

**Real panel:**
- Import the production component from `src/features/[topic]/ui/[Component].tsx`.
- Create a mock `Settings` / props object that matches production shapes.
- Wire all mutations (add, edit, delete, reorder, activate, universal change) so QA can exercise them.
- Use mock data in `mockData.ts`; keep it in sync with real type definitions.

**Each concept variant:**
- Is a standalone interactive wireframe using the same mock data and handlers.
- **Expresses one of the three visual archetypes** chosen in Step 2 and described in Step 3.
- Uses **project tokens only** — no hardcoded colors, spacing, or shadows.
- Does **not** import shared layout pieces (e.g. `ResourceGroup`, `SectionFrame`) from a `common.tsx` helper across all three concepts.
- May introduce new structural components or patterns when existing shared components cannot express the archetype. New components are mapped to the design system in Step 8, not invented without a reason.
- Implements the states defined in Step 3.
- Is mobile-first and uses `@container` or `@media` for desktop enhancement.
- Respects touch targets ≥ 44 × 44 px and accessible focus states.
- Includes motion only if the dial allows it; honors `prefers-reduced-motion`.

**Guard:** Every concept has at least default, hover, focus, active, disabled, and empty states visible in the mockup. Mobile and desktop layouts both render correctly.

**Loop back:** If a concept breaks below 375 px or cannot render in dark mode, fix it before presenting.

---

## Step 6 — Produce the design brief

**Purpose:** Capture the concepts and trade-offs so the choice is documented.

**Write `docs/intent/[topic]-design-brief.md` with:**

- Design Read (one line).
- Function audit table from Step 1.5.
- User journey map from Step 1.6.
- 3 dials default and per-concept values.
- Inspiration anchor (feeling + non-digital reference + visual reference).
- Primary job.
- Context quote from `project-context.md` justifying at least one choice.
- Three concept cards (use the template below).
- Responsive behavior table: 320, 768, 1280, 1920.
- States list for the chosen direction.
- Audit findings addressed (if any).
- Anti-patterns the design avoids.
- A short note explaining why the three visual archetypes are different.

**Concept card template:**

```markdown
### Concept A — [Name]

- **IA mental model:** ...
- **Visual archetype:** ...
- **Non-digital reference:** ...
- **Material / surface:** ...
- **Typography treatment:** ...
- **Motion signature:** ...
- **UX flow:** ...
- **UI structure:** ...
- **3 dials:** DESIGN_VARIANCE: X, MOTION_INTENSITY: Y, VISUAL_DENSITY: Z
- **Why it fits:** ...
- **Risk:** ...
- **Audit findings:** | finding | solve / defer / reject | rationale |
```

**Guard:** The brief has three distinct concept cards, each with a different IA, a different visual archetype, and at least one context quote.

**Loop back:** If any concept card is missing a risk or dial value, complete it before opening the mockup.

---

## Step 7 — Present and choose

**Purpose:** Let the user experience the concepts and commit to one.

**Actions:**
1. Run `npm run dev` and open the mockup page URL.
2. Present the URL to the user with a short summary of the three concepts.
3. Ask the user to pick one and explain why.
4. Note any adjustments (e.g., "Concept A but with Concept B's empty state").

**Guard:** The user explicitly picks one concept or asks for a specific mix.

**Loop back:** If the user cannot decide, ask them to rank the concepts by one criterion: "Which one makes the primary job easiest to complete?"

---

## Step 8 — Map to the component system

**Purpose:** Reconcile the chosen visual archetype with the design system. This is the **first** time you read `src/shared/ui/*` and `src/features/*` in this workflow.

**Actions:**
1. **Deconstruct** the chosen mockup into elements: buttons, toggles, cards, lists, menus, popovers, sheets, badges, forms, etc.
2. **Read** `src/shared/ui/*` and `src/features/*` to know the component inventory.
3. For each element, decide one of:
   - **Reuse** — an existing component fits the archetype as-is.
   - **Extend** — an existing component needs a new variant or prop to match the archetype.
   - **Redesign** — an existing component's behavior or style must change.
   - **Create** — a new component is needed because no existing one can express the archetype.
4. Document the mapping in `docs/intent/[topic]-component-mapping.md`.
5. Hand off to `frontend-ui-engineering` or `spec-driven-development` for implementation.

**Guard:** Every UI element in the chosen concept has a mapping decision. No existing component is forced to fit if a new component or a new pattern is required to keep the design intent.

**Loop back:** If the chosen concept must be flattened to reuse an existing component, ask the user whether to keep the design intent or change the component. Do not silently choose reuse.

---

## Output

- **Design brief:** `docs/intent/[topic]-design-brief.md` (3 concepts + trade-offs).
- **Mockup site:** `src/entrypoints/mockup-[topic]/` (real panel + 3 variants + viewport + theme).
- **Component mapping (post-choice):** `docs/intent/[topic]-component-mapping.md`.

---

## Anti-patterns

| Don't | Why |
|---|---|
| Start from existing components | Locks creativity too early. |
| Produce three color/style/border variations of the same interaction | Three border colors of the same card are still the same concept. |
| Use a `common.tsx` or shared layout helper across all concept files | Forces every concept to share the same skeleton and kills visual divergence. |
| Skip the function audit | You end up decorating features instead of solving the user's job. |
| Skip the user journey map | Layout becomes feature-driven ("tab A, tab B") instead of action-driven. |
| Let existing components flatten the chosen visual archetype | Reuse is good; forcing a dashboard bento concept into a generic `Card` is not. |
| Skip the real panel in the mockup | Users cannot compare the new direction against the shipped UI. |
| Build a static image instead of an interactive mockup | You cannot test states, hover, focus, or responsive behavior. |
| Skip viewport switching | Mobile-first becomes a claim, not a fact. |
| Skip theme switching | The concept may break in dark mode. |
| Skip the mapping step after choice | The mockup becomes unbuildable or inconsistent with the design system. |
| Invent new components without checking existing ones | Wastes code and breaks SSOT. |
| Ignore P0 audit findings during ideation | Re-designing over them repeats the same mistakes. |
| Start designing before reading `docs/context/project-context.md` | The project already owns the design story; asking the user repeats work and risks drift. |
| Use or reference Liquid Glass in concepts | Cell no longer uses Liquid Glass for new UI. Avoid blur/backdrop-filter and glass tokens; prefer solid/filled surfaces and standard tokens. |

## Common rationalizations

| If the user says... | Respond with... |
|---|---|
| "Just make it look nice" | "Nice for whom, doing what, on which screen?" |
| "Like Material Design" | "Which principle: color, elevation, motion, or layout?" |
| "I want it minimal" | "Minimal means removing something. What should this not do?" |
| "Copy YouTube" | "What specific feeling, and what must we change to fit Cell?" |
| "Use blue and green" | "Which is dominant, which is accent, what neutral ties them?" |
| "I don't know the design system" | "The project context and tokens already define it. Let's read those first." |
| "I want to fix this button" | "Do you have an audit brief, or should we run `audit-ui-ux-then-redesign` first?" |
| "Skip the real panel, it's too hard" | "If we can't mount the real UI, we can't prove the new direction is better." |

---

## Verification

- [ ] `docs/context/project-context.md` and design system token files were read before ideation; `src/shared/ui/*` was **not** read before Step 8.
- [ ] A function audit table exists and the one primary job is stated.
- [ ] A user journey map with begin/middle/end and edge cases exists.
- [ ] If an audit brief exists, findings were mapped to each concept's decisions.
- [ ] The user named a concrete feeling, one non-digital reference, one visual reference (if any), one primary job, and the 320/1280 behavior.
- [ ] Three concepts each have a different IA mental model, a different visual archetype, and a different primary layout pattern.
- [ ] No two concepts can be turned into each other by only changing `border-color`, `background`, or `border-radius`.
- [ ] Each concept card includes visual archetype, non-digital reference, material, typography, motion, 3 dials, states, flow, and risk.
- [ ] The three concept files do **not** import shared layout pieces from a `common.tsx` helper.
- [ ] A user can tell which concept is selected without reading the label.
- [ ] The mockup site has concept, viewport, and theme switchers.
- [ ] The real production panel is mounted and interactive in the mockup.
- [ ] All three concept variants are interactive and use project tokens.
- [ ] Mobile (≤420 px) and desktop (≥640 px) layouts both render correctly.
- [ ] Light and dark themes both render correctly.
- [ ] `docs/intent/[topic]-design-brief.md` and `docs/intent/[topic]-component-mapping.md` are written.
- [ ] Every UI element in the chosen concept has a reuse / extend / redesign / create decision.

---

## Router boomerang

- Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route.
- If the user is describing a problem with **existing UI** → use `audit-ui-ux-then-redesign` first, then return here.
- If the user has an audit brief and is ready to design the fix → start at Step 0 and treat the brief as top-level constraints.
- If the design is already fixed → hand off to `frontend-ui-engineering`.
