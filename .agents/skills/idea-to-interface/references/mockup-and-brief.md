# Idea-to-Interface — steps 4–8 detail

## Step 4 — Mockup site shell

```text
src/entrypoints/mockup-[topic]/
├── index.html          # Vite HTML entrypoint
├── main.tsx            # shell: concept/viewport/theme switchers + stage
├── real.tsx            # shipped production component, mounted live
├── ConceptA.tsx        # standalone interactive wireframe
├── ConceptB.tsx
├── ConceptC.tsx
├── mockData.ts         # shared mock state and helpers
├── state.tsx           # shared mock state logic (state only, never UI layout)
└── mockup.css          # shell + concept styles, mobile-first
```

**Isolation rule:** each Concept file expresses its own archetype. No `common.tsx` exporting shared layout pieces (`ResourceGroup`, `SectionFrame`) — that forces the concepts to look the same. `mockData.ts`/`state.tsx` may share data and handlers.

**Shell controls (always visible above the stage):** concept switcher (Real + A/B/C) · viewport switcher (Mobile ≤420px, Desktop ≥640px, optional custom width) · theme switcher (Light/Dark via `data-theme`/`data-preset`).

**Stage:** `container-type: inline-size`; defaults to Mobile; border/surface/radius from tokens; concept note explaining IA + archetype; concept identifiable without reading the label.

Loop back: real panel can't mount → fix mock wiring, never skip it.

## Step 5 — Real panel + three variants

**Real panel:** import production component from `src/features/[topic]/ui/[Component].tsx`; mock `Settings`/props matching production shapes; wire all mutations (add/edit/delete/reorder/activate).

**Each variant:** standalone interactive wireframe on the same mock data; expresses its archetype; project tokens only; no shared layout pieces; new structural components allowed when existing ones can't express the archetype (mapped in Step 8); all states; `@container`/`@media` for desktop; touch ≥44px; motion per dial + `prefers-reduced-motion`.

Loop back: breaks below 375px or in dark mode → fix before presenting.

## Step 6 — Design brief

Write `docs/intent/[topic]-design-brief.md`: Design Read (one line) · function audit table · journey map · dials (baseline + per-concept) · inspiration anchor (feeling + non-digital + visual ref) · primary job · context quote justifying a choice · 3 concept cards · responsive table (320/768/1280/1920) · states for chosen direction · audit findings addressed · anti-patterns avoided · why the archetypes differ.

Concept card:

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

## Step 7 — Present and choose

`npm run dev` → open the mockup URL → present with a one-line summary per concept → user picks one (or a specific mix). Can't decide → rank by "which makes the primary job easiest?"

## Step 8 — Component mapping (first time `src/shared/ui/*` is read)

1. Deconstruct the chosen mockup into elements (buttons, toggles, cards, lists, menus, popovers, sheets, badges, forms).
2. Read `src/shared/ui/*` + `src/features/*` for the inventory.
3. Per element decide: **Reuse** / **Extend** (new variant or prop) / **Redesign** (behavior or style change) / **Create** (nothing can express the archetype).
4. Document in `docs/intent/[topic]-component-mapping.md`.
5. Hand off to `spec-driven-development` + `incremental-implementation`.

Loop back: chosen concept would be flattened to reuse an existing component → ask the user: keep design intent or change the component. Never silently choose reuse.

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
