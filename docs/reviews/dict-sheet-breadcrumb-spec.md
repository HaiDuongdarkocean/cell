# Spec review: dict-sheet-breadcrumb

`spec-reviewer` subagent, single pass, BA/PO/TL lenses, against `docs/specs/dict-sheet-breadcrumb.md` + intent `docs/intent/dict-sheet-breadcrumb.md`.

## Verified against code

`targetIdx` force `popupLifecycle.ts:387` ✓ · `closeFromLevel` :158–169 ✓ · `isSheetMode` :141–143 ✓ · `levelIndexForTarget` host match ✓ · `setOptions`/`setResult`/`dismissOnOutsideClick` API ✓ · `Sheet` no header slot + `aria-modal` hardcoded (`Sheet.tsx:92`) ✓ · `Breadcrumb` label-only + `/` CSS separator + no overflow-x ✓ · `PopupLevel` chưa có `lookupTerm` ✓.

## Findings (merged)

**Blockers:** none.

**Major**
1. NFR-4/AC-9: `aria-modal` fix alone insufficient — covered sheets stay in DOM with focusable content reachable by SR virtual cursor → need `inert`/`aria-hidden` too.
2. REQ-5 alt flow: Escape mechanism attribution wrong — each `Sheet` registers `pushEscapeLayer` (capture-phase, LIFO, stopPropagation) so `onStackKeydown` never runs while a sheet is open. Outcome identical; mechanism statement misleading.
3. Missing edge cases: viewport crossing breakpoint mid-stack; long crumb label truncation.

**Minor**
1. REQ-2 precondition "depth ≥ 2" contradicts step 3 handling depth < 2 → should be "top sheet rendered".
2. REQ-4 exception flow empty.
3. AC-9 has no traceability row (traces to intent risk, not a Need).
4. Boundaries "Ask first" on shared-atom props lacks gate owner.
5. Spec mandates `>` separator but doesn't name the needed `separator` prop on `Breadcrumb` — risk of second hand-rolled breadcrumb.

## Verdict rationale

Mechanism sound (reuse proven stack path); all additions additive; every load-bearing claim accurate. Fixes are surgical text edits.

## Applied fixes

- REQ-5 alt flow rewritten — Escape attribution corrected to per-sheet `pushEscapeLayer`; `onStackKeydown` scope clarified.
- NFR-4 + AC-9 + function map: non-top sheets get `inert` in addition to `aria-modal` off.
- REQ-2: precondition → "top sheet đã render"; alt flow gains truncation rule; rules name the `separator` prop on `Breadcrumb` (no second breadcrumb).
- REQ-4: exception filled (scroll failure → crumbs still reachable, `scrollIntoView` errors ignored).
- AC-10 added (label truncation); traceability rows for aria-modal risk + truncation edge.
- Accepted risks: added viewport-crossing-breakpoint-mid-stack note.

VERDICT: APPROVE_WITH_CHANGES
