# Analyze review: dict-sheet-breadcrumb

Fresh-context audit (subagent_explore, mode `all`) of `docs/intent/dict-sheet-breadcrumb.md`.

## Citation verification — all check out

| Doc claim | Verified |
|---|---|
| `popupLifecycle.ts:387` forces `targetIdx = 0` in sheet mode | `popupLifecycle.ts:387` — `const targetIdx = isSheetMode() ? 0 : sourceIdx + 1;` |
| `closeFromLevel` `popupLifecycle.ts:158-169` | exact span; semantics match |
| `isSheetMode` `popupLifecycle.ts:141-143` | exact; `POPUP_SHEET_BREAKPOINT_PX` = `BREAKPOINTS.medium` (`popupGeometry.ts:20`) |
| `levelIndexForTarget` `lookupTargetDom.ts:123-130` | returns stack index via shadow host, `-1` for page text |
| `Sheet.tsx` no scrim | `Sheet.tsx:87-122` — only `.sheet` + `.handle` + `.content` |
| `Breadcrumb.tsx` exists | yes, plus module.css/showcase/test |
| `webTextDictionaryController.test.ts:1729+` nested-stack tests | `describe('nested popup stack')` starts at `:1729` |

## Structure

- Journey: AS-IS 4 steps, TO-BE 5; TO-BE ends at promised value (jump back + reset).
- Needs: N1/N5/N6 clean; N2–N4 embed user-dictated solution constraints (verbatim requirements), acceptable.
- Scope bounded; `ui_surface: yes` consistent.

## Technical premise — verified

- Stacked sheets: `.sheet` fixed bottom-anchored, hosts zero-size, shared `POPUP_Z_INDEX` → DOM order stacks deeper on top; no scrim → no visual weirdness.
- Escape: `pushEscapeLayer` capture-phase LIFO beats the lifecycle bubble listener — one Escape = one level.
- Focus: per-panel traps don't fight; `closeFromLevel` refocuses exposed level.
- `useSheet` document listeners are session-gated → N sheets safe.
- `dismissOnOutsideClick===false` early-returns before `onOutsidePointerDown` — page lookups reset chain via `targetIdx=0` prune for free.
- Desktop unaffected — stack tests run at jsdom 1024px.

## Issues raised

1. `Breadcrumb` atom: label-only items (caller passes `<button>`), separator `/` vs user's `>`, `.list` lacks `overflow-x` — DESIGN concern.
2. `Sheet` has no fixed header slot; strip inside `.content` sits in drag-dismiss zone — placement decision for DESIGN.
3. Crumb plumbing: lifecycle must push trail to mounts (e.g. `setTrail`) on push/prune.
4. Stacked `aria-modal="true"` on N sheets is invalid ARIA — only top should be modal.
5. Emergent "tap peeking parent to prune" affordance (parent taller than child after resize).

## Applied fixes

- Workflow: named the trail-sync path (lifecycle → mounts) explicitly.
- Added "Design constraints" list covering separator, Sheet header slot, and crumb plumbing.
- Risks: added rows for stacked `aria-modal` and peeking-parent prune.

VERDICT: APPROVE_WITH_CHANGES
