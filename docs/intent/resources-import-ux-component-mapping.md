# Resources import UX — Component Mapping

## Chosen concept

**Concept B — Water fill**: dropped files land as placeholder cards *inside* the resource list; a `--color-primary-subtle` fill rises through the card as entries stream in, then the card solidifies into a real resource row. Left-edge six-dot `DragHandle` reorders with a lift animation; the right column embeds the real dictionary popup surface; the per-resource "Thử tra từ" block is removed.

## Production components

| Production component | Decision | Notes |
|---|---|---|
| `Card` (`@/shared/ui/Card`) | **Reuse** | Job placeholder and resource row share the card grammar; pending state = dashed frame + dimmed title. |
| `DragHandle` (`@/shared/ui/DragHandle`) | **Reuse** | Six-dot grip, `draggable`, `role="button"`, arrow-key reorder built in — exactly the Yomitan-style affordance. Replaces up/down buttons. Disabled while its row is an active job. |
| `Progress` (`@/shared/ui/Progress`) | **Reuse** | Fallback bar only if the rising fill fails a11y review; primary channel is the fill layer + % text. |
| `Spinner` (`@/shared/ui/Spinner`) | **Reuse** | Right-edge indicator while the exact entry count is being computed (indeterminate phase). |
| `Icon` (`@/shared/ui/Icon`) | **Reuse** | Terminal states icon `circleCheck` (done) / `alertCircle` (error) / `triangleAlert` (duplicate); expander chevron `chevronDown`. |
| `IconButton` (`@/shared/ui/IconButton`) | **Reuse** | Delete action icon `trash`, unchanged. |
| `Toggle` (`@/shared/ui/Toggle`) | **Reuse** | Enable/disable resource, unchanged. |
| `Button` (`@/shared/ui/Button`) | **Reuse** | Duplicate-prompt actions (replace/skip), unchanged semantics. |
| `VisuallyHidden` (`@/shared/ui/VisuallyHidden`) | **Reuse** | `aria-live="polite"` per-file status announcements. |
| `Skeleton` (`@/shared/ui/Skeleton`) | **Reuse** | Initial resource-list load state, unchanged. |

## Feature-module mapping

| Module | Change | Notes |
|---|---|---|
| `ResourcesPanel` | **Rework** | Per-file `jobId`-keyed job state (replaces single section `ImportState`); bounded-concurrency dispatcher; two-column shell hosting the lookup column; dropzone never disables. |
| `ResourceCard` | **Rework** | Add `DragHandle` at left edge, remove up/down buttons, lift-on-drag (`--shadow-floating` + dashed placeholder), persist via existing `reorderResources`. |
| `ResourceDetail` | **Trim** | Remove "Thử tra từ" block + its state; keep sample entries + profile assignment. |
| `ImportProgress` | **Rework** | Render one job row per file: spinner → `processed / total` + fill + % → terminal icon; accepts a job record, not just numbers. |
| `Dropzone` | **Keep** | Remains enabled during imports; no structural change. |
| `DictionaryPanelView` (`variant="integrated"`) | **Reuse as-is** | Right-column lookup — real popup surface backed by `useDictionaryPanel` + `useDictionaryLookup`; editable query, dictionary + frequency results. |
| `BatchProcessor` / strategies | **Extend** | Emit exact `total` alongside `processed` (spec: pre-count per format); plumbing field already exists end-to-end. |

## Mockup to production mapping

- `src/entrypoints/mockup-resources-import-ux/ConceptB.tsx` → job-card markup + `.bCard`/`.bFill` CSS pattern port to `ResourcesPanel.module.css` (pending card, fill layer, right-edge status cluster).
- `state.tsx` job model (`queued → counting → importing → done|error|duplicate`) → job reducer inside `ResourcesPanel` keyed by `jobId`.
- Right-column lookup mock → real `DictionaryPanelView` mount in `ResourcesPanel`'s new two-column shell.
- Mockup directory deleted at ship (output hygiene).

## Anti-patterns avoided

- No new dependency — HTML5 drag-and-drop + existing `DragHandle`.
- No parallel `Promise.all` unbounded — dispatcher caps in-flight jobs.
- No second lookup implementation — `DictionaryPanelView` integrated variant is reused verbatim.
- No hardcoded totals — `/100` path deleted; `total` comes from exact per-format counting.
