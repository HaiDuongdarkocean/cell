---
name: idea-to-interface
description: Transform a confirmed business intent into 3 independent UI/UX design concepts, then map the chosen concept to the project's component system. Not bounded by existing components until the final mapping step.
---

# Idea-to-Interface

> Take a raw idea → understand business function → generate 3 unconstrained interface concepts → map the chosen one to existing or new components.

## When to use

- User says "làm sao để user tương tác với tính năng X?" or wants a redesign but doesn't know the right UI.
- A `docs/intent/[topic].md` already exists with business / user journey confirmed.
- The user wants to see 3+ design options before committing to one.
- After a concept is chosen, the agent must decide whether to reuse, extend, or create components.

## When NOT to use

- The design is already fixed → implement directly with `frontend-ui-engineering`.
- No intent / spec exists → use `interview-me`, `elicitation`, or `inquiry-creativity` first.
- The task is a pure audit → use `audit-ui-ux-then-redesign`.

---

## Core principles

> **Design from function, not from inventory.**
>
> The first phase is *ideation*: forget the existing component library and ask "what is the best UI for this behavior?".
> The second phase is *mapping*: reconcile the ideal UI with the design system, token system, and codebase reality.

> **Mobile-first by default.**
>
> Start the design at the narrowest practical viewport (320–420 px), then enhance for desktop. Every concept must answer:
> - Will it fit a 375 px header?
> - Are touch targets ≥ 44 × 44 px?
> - Does the advanced menu become a bottom sheet / full-width action on mobile?
> - Is the thumb zone respected?
>
> Desktop enhancement is layered on top, not the other way around.

> **Skill has its own initiative.**
>
> The skill does not wait for the user to ask "what about mobile?". It proactively generates a mobile-first mockup, raises the mobile risks, and proposes the bottom-sheet / full-width pattern as the default before the user asks.

---

## Phase 1 — Load context

Inputs:
- `docs/intent/[topic].md` — business intent, user journey, constraints.
- `DESIGN.md` / `AGENTS.md` / `tokens.css` — design-system constraints and tokens.
- Existing related components in `src/shared/ui/*` or `src/features/*`.

Actions:
1. Read the intent doc.
2. Extract the **one core action** and the **one core decision** the user must make.
3. List **must-haves** from the intent (e.g., "both Media and Text can be active at the same time").
4. Note **out-of-scope** or deferred decisions.
5. Read the design system surface for *inspiration only* — do not let it limit the first 3 concepts.

---

## Phase 2 — Generate 3 unconstrained concepts

For each concept, define:

| Field | What to capture |
|-------|-----------------|
| **Name** | One short, memorable label. |
| **IA mental model** | How the user thinks about the control (e.g., "master switch reveals children", "direct multi-select", "mode dial"). |
| **UX flow** | Step-by-step user actions and system reactions. |
| **UI structure** | Layout, hierarchy, motion, and key elements. |
| **Why it fits** | Mapping back to the intent and user journey. |
| **Risk** | Why it might fail (complexity, discoverability, accessibility, space). |

Rules for the 3 concepts:
- Each concept must have a **different IA/UI/UX** pattern, not just a different color or shape.
- Concepts can propose **new patterns** or **new components** if the intent demands them.
- One concept may deliberately push the boundary (experimental); one may be conservative; one may be a hybrid.
- Do not use the same interaction family twice (e.g., do not do three variations of chips).

---

## Phase 3 — Produce mockups

1. Create a single HTML showcase file under `src/entrypoints/design-system-showcase/mockups/[topic]-idea-to-interface-concepts.html`.
2. Each concept gets its own section / panel with real interactivity (JavaScript + CSS).
3. Default the viewport to **mobile (≤420 px)** in the mockup; use `@media (min-width: 640px)` to layer desktop enhancements.
4. Show the mobile pattern first, then desktop enhancement (e.g., floating popover → desktop, bottom sheet → mobile).
5. Use a consistent project palette for the *mockup container* but allow each concept to explore its own visual language.
6. Include motion/animation for state changes.
7. Open the file in the design-system dev server and present the URL.

---

## Phase 4 — Mapping (after user chooses)

When the user picks one concept, run the mapping step:

1. **Deconstruct** the chosen mockup into elements: buttons, toggles, chips, menus, popovers, sheets, badges, etc.
2. **Compare** each element to the design system's existing components:
   - Read `src/shared/ui/*` component APIs.
   - Check `DESIGN.md` for tokens, variants, and patterns.
3. For each element, decide one of:
   - **Reuse** — an existing component fits as-is.
   - **Extend** — an existing component needs a new variant or prop.
   - **Redesign** — the component's behavior or style must change.
   - **Create** — a new component is needed.
4. Document the mapping in a brief: `docs/intent/[topic]-component-mapping.md`.
5. Hand off to `frontend-ui-engineering` or `spec-driven-development` for implementation.

---

## Output

- **Design brief:** `docs/intent/[topic]-design-brief.md` (3 concepts + trade-offs).
- **Mockups:** `src/entrypoints/design-system-showcase/mockups/[topic]-idea-to-interface-concepts.html`.
- **Mapping (post-choice):** `docs/intent/[topic]-component-mapping.md`.

---

## Anti-patterns

| Do not | Why |
|---|---|
| Start from existing components | Locks creativity too early. |
| Produce 3 color/style variations of the same interaction | Doesn't solve the real unknown. |
| Skip the mapping step after choice | The mockup becomes unbuildable or inconsistent with the design system. |
| Invent new components without checking existing ones | Wastes code and breaks SSOT. |
| Skip accessibility checks on the chosen concept | Design debt becomes a blocker later. |
