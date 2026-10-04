# Todo: dict-sheet-breadcrumb

## Implementation
- [x] `PopupLevel.lookupTerm` + init
- [x] `popupLifecycle`: `targetIdx = sourceIdx + 1` (all modes), `syncTrail()`, `onTrailNavigate → closeFromLevel(i+1)`
- [x] `mountPopupDictionary`: `trail` / `isTopLevel` / `onTrailNavigate` options + `setOptions` keys
- [x] `Sheet`: `header` / `modal` / `inert` additive props
- [x] `Breadcrumb`: `separator` prop (CSS var `--breadcrumb-separator`, default `/`)
- [x] `LookupTrail` + CSS module (scroll-x, wheel map, edge fades, auto-scroll-end, ≥2 gate)
- [x] `Dictionary` sheet branch: `LookupTrail` via `Sheet.header`, `modal`/`inert` per `isTopLevel`
- [x] i18n `dict.trail.backTo` (en + vi)
- [x] `handlePopupSizeChange` zero-guard (sheet resize no longer corrupts desktop popup geometry)
- [x] `docs/2-architechture-system.md` popup-stack rows updated
- [x] Remove `src/entrypoints/mockup-dict-sheet-breadcrumb/`

## Verify-fix round (fresh review FAIL → fixed)
- [x] D1: `Sheet` self-refocuses when `inert` lifts (wasInertRef + effect — deterministic vs. pre-commit `mount.focus()`)
- [x] D2: `LookupTrail` auto-scrolls to newest crumb on mount (`prevLengthRef` 0 + `useLayoutEffect`)
- [x] D3: `.cover` hit-catcher sibling on inert sheets + `preventDefault` in `onStackPointerDown` (tap-to-return, no page fall-through)

## Tests
- [x] Sheet-mode: nested push + trail render (`above > used`, aria-current, crumb buttons)
- [x] Crumb navigate → prune deeper levels
- [x] Page lookup → chain reset to level 1
- [x] inert + aria-modal layering (top only)
- [x] Escape pops one level, reveals parent (modal restored)
- [x] Existing nested-stack desktop tests still pass (24/24 in suite)
- [x] e2e: cover presence/absence, mount auto-scroll, wheel scroll, focus restored, covered-band tap → prune

## Gates
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test:unit` (7998)
- [x] `npm run build`

## Verify
- [x] Real Chrome: 5-level chain → crumb nav → Escape pop → covered-tap → page reset (e2e stage2, 3/3)
- [x] Screenshots/pixel evidence in verify artifact (`tmp/dict-sheet-breadcrumb/e2e-*.png`)
- [x] `docs/reviews/dict-sheet-breadcrumb-verify.md` — VERDICT: PASS
- [ ] Transition shipped via `scripts/pipeline-state.mjs`
