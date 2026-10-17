---
name: pipeline-design
description: DESIGN stage of the agentic SDLC — UI/UX decided and verified BEFORE implementation (design brief + component mapping + mockup + approval/vision gate). Only for items with ui_surface=yes. Absorbs idea-to-interface.
---

# Pipeline DESIGN

> spec + `ui_surface=yes` → function audit → journey → concepts → mockup → brief + component mapping → gate → `transition → deliver`.

## Overview

DESIGN exists because UI defects are the most expensive kind to find at ship time (the FAB lesson: wrong corner radius + off-palette color survived to production). The stage forces the design to be **decided, mapped to the real component system, and verified** before any `src/` product code is written.

Two hard rules:

1. **UI must follow the system, not invent it** — every interaction traces: journey step → REQ → function → feature → element. An element with no requirement behind it is scope creep; a requirement with no element is unbuildable.
2. **Verification is mandatory** — `check-design-brief.mjs` lints every token/component/icon reference, and a human (interactive) or `vision-reader` (all mode) judges the rendered mockup. `transition design→deliver` invokes the linter itself — a missing reference blocks the stage.

## When to Use

- Active item at `stage=design` (`uiSurface=yes`)
- Spec reviewed and approved (`docs/reviews/<slug>-spec.md` fresh)

## When NOT to Use

- `uiSurface=no` → `transition --to deliver` directly
- UI-touching bugfix → `debugging-and-error-recovery` (lighter component/token check)
- No spec → `pipeline-specify`; no intent → `pipeline-analyze`

## Stage Contract

```
in:   docs/specs/<slug>.md + uiSurface=yes
out:  docs/intent/<slug>-design-brief.md
      docs/intent/<slug>-component-mapping.md
      src/entrypoints/mockup-<slug>/          (design-time artifact — deleted at ship)
      docs/reviews/<slug>-design.md           (ends `VERDICT: <token>`)
exit: transition --to deliver
      (transition re-runs check-design-brief.mjs — unknown token/component/icon refuses)
```

## State Steps

```bash
node scripts/pipeline-state.mjs get <slug>
node scripts/pipeline-state.mjs set <slug> artifacts.designBrief=docs/intent/<slug>-design-brief.md
node scripts/pipeline-state.mjs set <slug> artifacts.componentMapping=docs/intent/<slug>-component-mapping.md
node scripts/pipeline-state.mjs set <slug> awaiting=user-approval:design   # interactive only
node scripts/pipeline-state.mjs transition <slug> --to deliver
```

## Interactive mode — the full pipeline

`references/concept-workflow.md` + `references/mockup-and-brief.md` (migrated from idea-to-interface, steps 0–8 unchanged):

```
0. Load context → 1. Anchor idea → 1.5 Function audit → 1.6 Map journey
→ 2. Job + dials → 3. Three divergent concepts → 4. Mockup shell
→ 5. Real panel + variants → 6. Design brief → 7. User picks → 8. Component mapping
```

Non-negotiables carried over:

- **Design from function and feeling, not inventory** — `src/shared/ui/*` is not read before Step 8; ideation isn't anchored on what exists.
- **Three genuinely different concepts** — different IA mental model + visual archetype + layout; not three skins of one idea. (`all` mode: single justified variant — see below.)
- **Mobile-first**, touch ≥40px, all states render, dark mode works.
- **Mockups are decision tools** — real production panel mounted + concept/viewport/theme switchers, interactive not static.
- **No Liquid Glass** — solid/filled surfaces + standard tokens.
- Every user-facing interaction in the mockup maps back to a journey step + REQ id.

**Approval:** user picks a concept (or explicit mix) on the rendered mockup → write the approval record to `docs/reviews/<slug>-design.md`, ending `VERDICT: APPROVE`.

## `all` mode — autonomous variant

No user to present three concepts to, so:

1. Interface analysis (function audit + journey, same as interactive steps 0–1.6).
2. Design brief + component mapping + **one justified variant** + ASCII layout sketch in the brief.
3. `node scripts/check-design-brief.mjs <slug>` — must pass before continuing.
4. Build `src/entrypoints/mockup-<slug>/` (single variant + real panel + switchers).
5. `npm run dev` → Playwright screenshot at mobile + desktop, light + dark.
6. `vision-reader` subagent judges DS-faithfulness (prompt template → `references/all-mode-vision.md`).
7. Write verdict report to `docs/reviews/<slug>-design.md`, ending `VERDICT: PASS|FAIL`.

FAIL → fix → re-lint → re-screenshot (bounded by loops=3).

## Component mapping — the anti-FAB artifact

`docs/intent/<slug>-component-mapping.md` — every element deconstructed gets a decision:

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| <what it is> | <Name> | reuse / extend / redesign / create | `--<token>` | `<catalog id>` |

Rules: `Component:` and `Icon:` field conventions are what `check-design-brief.mjs` parses — write them exactly. `create` requires a reason nothing in `src/shared/ui/` can express the archetype. Chosen concept would be flattened by forced reuse → ask the user, never silently reuse.

## Anti-patterns

| Don't | Why |
|---|---|
| Design before functions are mapped | UI decorates mechanism, not capability — the FAB failure |
| Element with no REQ trace | Scope enters through pixels instead of docs |
| Skip the real production panel | Side-by-side with shipped UI is the whole point of the mockup |
| Hand-drawn replica of the real panel (`real.tsx` vẽ lại bằng `.mk*`) | Baseline sai → mọi concept so với nó đều sai. Mount component thật; thiếu deps thì wire `mockChrome`/`installMockDictionarySendMessage`; quá entangled thì extract sub-component (StatusRow) chứ không copy markup |
| `common.tsx` shared layout across concepts | Kills visual divergence — three concepts collapse to one |
| Write tokens/colors ad hoc | `tokens.json` names only — the linter runs at transition |
| Treat mockup as ship code | `mockup-<slug>/` is a design-time artifact, deleted at ship |

## Verification

- [ ] Brief + mapping + mockup exist at canonical paths
- [ ] Every element in mapping has reuse/extend/redesign/create decision + token + icon
- [ ] Every user-facing interaction traces journey step → REQ → function → feature
- [ ] `node scripts/check-design-brief.mjs <slug>` exits 0
- [ ] Contract-changing structural decisions (mount contract, component API, event ownership) → ADR Proposed (`documentation-and-adrs`)
- [ ] Review artifact verdict APPROVE*/PASS, mtime ≥ mapping mtime
- [ ] `transition --to deliver` exits 0 (it re-runs the linter itself)

## Router boomerang

Task đổi → `/using-agent-skills`. Wrong need → `transition --to analyze`. Spec gap → `pipeline-specify`. Build → `pipeline-deliver`.
