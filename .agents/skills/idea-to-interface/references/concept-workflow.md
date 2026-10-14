# Idea-to-Interface — steps 0–3 detail

## Step 0 — Load context

1. Read `docs/context/project-context.md` → extract the design story (palette, shape, motion, persona, platform, constraints). It is SSOT — if it states a design story, use it; don't re-ask the user about style.
2. Read `docs/design-system/DESIGN.md` + `src/shared/styles/README.md` for tokens and audit rules.
3. Read `src/shared/styles/tokens.json` for the color/spacing/radius/shadow/motion vocabulary. **Do not read `src/shared/ui/*` yet.**
4. If the topic touches shared language, read `docs/1-share-language.md`.
5. If an `audit-ui-ux-then-redesign` brief exists, read it — every P0/P1 finding is a hard constraint.
6. Read the related feature code (`src/features/[topic]/*`, real panel, hooks) for *function*, not UI.

Loop back: `project-context.md` missing → `interview-me`/`elicitation` to extract it first.

## Step 1 — Anchor the idea

- If `project-context.md` has no design story: ask "one word or image that sums up this idea?"
- Capture a **non-digital reference** (real object/scene/material with the same mood — tủ sách cá nhân, bento box, sổ cái) + one visual reference if provided.
- Ask: "cheapest version that still delivers that feeling?" + "what would make this UI feel out of place?"
- Compare to the design story and audit brief; surface mismatches.

## Step 1.5 — Audit the function

List every function from the production component, intent/spec docs, audit brief, user's description. Classify:

| Function | Class | Why |
|---|---|---|
| ... | `must-have` / `nice-to-have` / `remove` / `merge` | one-line reason |

Identify **one primary job** — more than one → ask the user to pick or split tasks. Surface P0/P1 audit findings as constraints. Capture frequency + risk per function ("import weekly; delete-all rare but dangerous").

## Step 1.6 — Map the user journey

| # | Step | User action | System response | UI location |
|---|---|---|---|---|

Must have begin/middle/end + edge-cases row (empty, loading, error, first-time, one risky uncommon path). Mark **moments of uncertainty** (pause, backtrack, mistake). Must match the primary job — else fix one of them. Rewrite if feature-driven ("tab A, tab B") instead of action-driven ("I want to...").

## Step 2 — Job and dials

Baseline dials (each concept then pushes at least one differently):

- `DESIGN_VARIANCE` (1–10): distance from current UI
- `MOTION_INTENSITY` (1–10): animation amount
- `VISUAL_DENSITY` (1–10): compact ↔ airy

Three style families (different non-digital references), e.g. *solid editorial*, *dashboard bento*, *command deck*. Audit brief caps dials (e.g. motion too heavy → `MOTION_INTENSITY` ≤ 3). Describe 320px + 1280px behavior in one sentence each.

## Step 3 — Three divergent concepts

### 3.1 IA mental models — change what the user thinks the UI is

- **List / shelf:** "dãy quyển sách có thể sắp, bật, xóa"
- **Dashboard / bento:** "bảng các ô tile, mỗi ô một vùng tài nguyên"
- **Command deck / ledger:** "bảng điều khiển có chương, lệnh, chỉ số"

### 3.2 Visual archetypes — each differs in

surface · shape · typography rhythm · motion signature

### 3.3 Concept template

| Field | What to capture |
|---|---|
| Name | Short label tied to the archetype |
| IA mental model | How the user thinks about the control |
| Visual archetype | Style family |
| Non-digital reference | Real object/scene with the mood |
| Material / surface | Solid, filled, layered, paper, tile |
| Typography treatment | Scale, weight, label style, rhythm |
| Motion signature | Enter/change/respond |
| UX flow | Actions + reactions mapped to journey |
| UI structure | Layout, hierarchy, key elements |
| 3 dials | Values + which dial is pushed |
| States | default/hover/focus/pressed/active/disabled/loading/empty/error |
| Why it fits | Mapping to function audit, journey, intent, story |
| Risk | Complexity, discoverability, a11y, space |

**Rules:** different IA + archetype + layout per concept; same-container or same-interaction-family = same concept, delete one; conservative / hybrid / experimental spread; new patterns allowed if intent demands; every P0 finding solved, P1 solved/deferred/rejected with rationale.
