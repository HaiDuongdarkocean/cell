---
name: idea-to-interface
description: Turn a UI idea into three concepts and an interactive mockup mapped to the component system. Use before implementing UI.
---

# Idea-to-Interface

> Raw or confirmed idea → function audit → user journey → three divergent concepts → live mockup with the real panel → user picks → map to the component system.

## When to use

- "I want a component that...", "làm sao để user tương tác với X?", "redesign this panel"
- A `docs/intent/[topic].md` or `docs/specs/[topic].md` exists with journey confirmed
- The user wants real alternatives before code; the redesign needs side-by-side comparison with the shipped UI

## When NOT to use

- Design already fixed → implement via `spec-driven-development` + `incremental-implementation`
- No intent/spec and user can't articulate the need → `interview-me` / `elicitation` / `inquiry-creativity` first
- Pure audit of existing UI → `audit-ui-ux-then-redesign` first, then return here
- Debugging, testing, performance

## Core principles (non-negotiable)

- **Design from function and feeling, not inventory.** Phase 1 ideates without the component library; phase 2 reconciles with tokens and codebase. The chain: audit function → map journey → shape IA → craft UX/UI. A concept is a different answer to the same journey, not a new coat of paint.
- **Diverge visually before wireframing.** Each concept owns a distinct visual archetype (solid editorial, dashboard bento, mechanical ledger...). Three concepts = three different products, not three skins.
- **Mobile-first.** Start at 320–420px; touch targets ≥44px; thumb zone respected.
- **Mockups are decision tools.** Every mockup includes the real production panel + theme + viewport switchers + 3 variants.
- **No Liquid Glass** — Cell dropped it for new UI: no `variant='glass'`, `material='liquid'`, `color-glass-*`, `blur-*`, `backdrop-filter`. Solid/filled surfaces + standard tokens.
- **`src/shared/ui/*` is not read before Step 8** — component inventory is deferred so ideation isn't anchored on what exists.

## The pipeline

```
0. Load context → 1. Anchor idea → 1.5 Audit function → 1.6 Map journey
→ 2. Job + dials → 3. Three divergent concepts → 4. Mockup shell
→ 5. Real panel + variants → 6. Design brief → 7. Present & choose → 8. Component mapping
```

| Step | Done when |
|---|---|
| 0. Context | One-sentence design story + one core action/decision + one component covering ≥60% + top audit constraints. `project-context.md` is SSOT for design story — don't re-ask the user |
| 1. Anchor | User names a feeling + non-digital reference + primary job in one sentence |
| 1.5. Function audit | One primary job + top-3 must-haves + one merge/remove candidate |
| 1.6. Journey | Begin/middle/end + edge-case row; first/last user actions stated; action-driven not feature-driven |
| 2. Job + dials | Primary job + baseline DESIGN_VARIANCE/MOTION_INTENSITY/VISUAL_DENSITY + 320/1280 behavior + 3 distinct style families |
| 3. Three concepts | Each has different IA mental model + visual archetype + layout pattern; can't be turned into each other via border-color/background/radius alone; conservative/hybrid/experimental spread; all P0 audit findings solved |
| 4. Mockup shell | `src/entrypoints/mockup-[topic]/` with concept + viewport + theme switchers; stage is `container-type: inline-size`, defaults to Mobile; **no `common.tsx` shared layout across concepts** |
| 5. Variants | Real panel mounted + wired; each variant interactive, token-only, mobile-first, all states render |
| 6. Brief | `docs/intent/[topic]-design-brief.md`: 3 concept cards + journey + audit mapping + context quote |
| 7. Choose | User explicitly picks one concept or a specific mix |
| 8. Mapping | Every element gets reuse/extend/redesign/create → `docs/intent/[topic]-component-mapping.md`; hand off to `spec-driven-development` |

→ Full step actions, function-audit/journey/dial/concept-card templates, mockup shell spec, rationalization responses: `references/concept-workflow.md` + `references/mockup-and-brief.md`

## Anti-patterns (top offenders)

- Starting from existing components; three style variations of the same interaction
- `common.tsx` shared layout across concept files (kills visual divergence)
- Skipping function audit, journey map, real panel, or viewport/theme switchers
- Static image instead of interactive mockup
- Letting an existing component flatten the chosen archetype — ask the user rather than silently reuse
- Liquid Glass anywhere in concepts
- Inventing components without checking `src/shared/ui` at Step 8 (SSOT)

## Verification

- [ ] `project-context.md` + tokens read before ideation; `src/shared/ui/*` untouched until Step 8
- [ ] Function audit + one primary job + journey map with edge cases exist
- [ ] 3 concepts: different IA, archetype, layout; no `common.tsx`; visually distinguishable without labels
- [ ] Mockup has real panel + concept/viewport/theme switchers; mobile + dark mode render correctly
- [ ] Brief + component mapping written; every element has a reuse/extend/redesign/create decision
- [ ] No Liquid Glass; P0 audit findings solved in every concept

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Existing-UI problem → `audit-ui-ux-then-redesign` first. Design fixed → `spec-driven-development` + `incremental-implementation`.
