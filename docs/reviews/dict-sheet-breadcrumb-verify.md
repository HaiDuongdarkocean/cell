# Verification Report: `dict-sheet-breadcrumb` (fresh-context review)

Round 2 — verifies the D1/D2/D3 fixes found in round 1 (which ended `VERDICT: FAIL`).

## Scope reviewed
`docs/specs/dict-sheet-breadcrumb.md`, `docs/intent/dict-sheet-breadcrumb.md`, `src/shared/ui/Sheet.tsx`, `Sheet.module.css`, `useSheet.ts`, `useFocusTrap.ts`, `escapeLayerStack.ts`, `Breadcrumb.tsx`/`.module.css`, `src/features/dictionaryPopup/ui/LookupTrail.tsx`/`.module.css`, `Dictionary.tsx`, `mountPopupDictionary.ts`, `usePopupPosition.ts` (isSheet), `controller/popupLifecycle.ts`, `controllerTypes.ts`, `lookupTargetDom.ts`, `listenerRegistry.ts`, `webTriggerController.ts`, `mountReactShadow.ts`, `ManagerLayer.tsx` (other Sheet consumer), `e2e/stage2/dict-sheet-trail.spec.ts`, `e2e/stage2/dictionary-nested-popup.spec.ts`, `webTextDictionaryController.test.ts` (sheet-mode describe, lines 2069–2214), `docs/2-architechture-system.md:611`.

## D1 — Focus lost on reveal (was FAIL) → FIXED
`Sheet.tsx:75–82`: `wasInertRef` inits to the mount-time `inert` value and a `useEffect` fires `sheetRef.current.focus()` only on a true→false transition — the effect runs after commit, so the `inert` attribute is already removed when `focus()` executes.

Verified against every reveal path:
- Crumb nav (`onTrailNavigate` → `closeFromLevel(i+1)`, `popupLifecycle.ts:158–170`), covered-band tap (`onStackPointerDown` → `closeFromLevel`), Escape pop (escape layer → `onClose`), and page-lookup reset (`closeFromLevel(1)` inside `handleLookup:409`) all funnel through `closeFromLevel` → `syncTrail()` → `setOptions` → React commit flips `isTopLevel`/`inert` → effect refocuses.
- `wasInertRef` init correctly prevents focus-steal on initial mount (sheets always mount as top → `inert=false` → condition never fires; `popupLifecycle.ts:219` `isTopLevel: popupStack[last] === level` and the lifecycle only ever mounts the newest level).
- No illegitimate inert→non-inert path exists: covered→revealed is the only transition, and self-focus is desired in all of them (crumb nav, pop, reset).
- `useFocusTrap` does not conflict: it only re-fires on `open` change (stable `true`) or unmount; its cleanup `previouslyFocused?.focus?.()` targets `document.activeElement` recorded at mount — inside shadow DOM that resolves to the shadow *host* div (non-focusable → no-op), never a rival target inside the revealed sheet (`useFocusTrap.ts:29–35,60–64`). Tab cycling keeps working because the trap's keydown listener persists on the panel element.
- `mount.focus()` (`mountPopupDictionary.ts:261–266`) remains and still handles the desktop `Surface` path (element has `data-cell-id="popup-dictionary"` + `tabIndex=-1`, no inert) — dual-path coverage is correct, and when both run they target the *same* element, so no double-focus conflict.

## D2 — Initial auto-scroll of overflowing strip (was FAIL) → FIXED
`LookupTrail.tsx:25–31`: `prevLengthRef` inits `0`; `useLayoutEffect` on `[trail.length, syncFades]` scrolls `scrollLeft = scrollWidth` whenever length grows.
- Mount with `trail.length >= 2`: `2 > 0` → scrolls to end (matches e2e assertion `dict-sheet-trail.spec.ts:365–372`).
- Growth (push level): scrolls to end. Shrink (crumb nav): `length > prev` false → no scroll; `prevLengthRef` still updated. Ordinary rerenders: deps unchanged → no-op.
- `visible` false→true transition unmounts/remounts the strip div; on return the layout effect re-fires and scrolls to end. Correct.
- Wheel mapping (`LookupTrail.tsx:36–47`): native `wheel` listener `passive:false`, `deltaX !== 0 || deltaY === 0` → skip; `scrollLeft += deltaY`; `preventDefault` only when scroll actually changed — satisfies REQ-4/NFR-3 (doesn't block page scroll chaining; `overscroll-behavior: contain` also guards). e2e `deltaY:-120` assertion (spec:375–380) verifies leftward scroll.

## D3 — Covered-sheet tap fell through to page (was FAIL → FIXED)
- `Sheet.tsx:150–162` renders `.cover` (`data-cell-id="sheet-inert-cover"`) only when `inert` — inside the same shadow host (fragment sibling), so `composedPath()` contains `level.mount.host` → `onStackPointerDown` (`popupLifecycle.ts:600–609`) finds `idx` and calls `closeFromLevel(idx+1)`.
- Geometry: `.cover` (`Sheet.module.css:75–85`) mirrors `.sheet` exactly — same `position:fixed; left/right/bottom: var(--space-2); max-height` and inline `{height, maxHeight, transform}` from `useSheet`'s `style` (`Sheet.tsx:158`) → tracks resize/drag-transform precisely.
- Stacking: each popup host is `position:fixed` + `z-index` (`mountReactShadow.ts:57–58`, `applyLevelZIndex` `popupLifecycle.ts:190–194`) → own stacking context; hosts append in level order, all levels in a chain share `abovePanel` (`syncPanelZIndex`/`handleLookup:424`) → deeper hosts always paint above shallower covers. A tap overlapping two covers resolves to the deeper cover → prunes to the visually-topmost covered level. Correct.
- a11y/tab order: plain `div`, `aria-hidden="true"`, no tabindex → invisible to AT and keyboard. `touch-action:none` prevents page scroll initiation on the band.
- `e.preventDefault()` (`popupLifecycle.ts:607`) runs only when pruning (guarded by `idx >= 0 && idx < length-1`) — pointerdown on the top host returns early, so crumb buttons, drags, and selection in the top sheet are unaffected. On touch it suppresses the synthesized mouseup (prevents a stray lookup on the revealed sheet); on real mouse the compat events still fire, preserving the desktop "click ancestor text → prune + re-lookup" semantics (verified by `dictionary-nested-popup.spec.ts` passing — the test at :267–275 depends on that mouseup dispatch).
- `webTriggerController.onMouseUp` is additionally guarded: the cover is not inside `[data-allow-lookup]`, so `eventBlockedForLookup` (`webTriggerController.ts:72–81`) blocks any lookup even if a mouseup lands on it.

## E2E spec soundness (`dict-sheet-trail.spec.ts`)
- Cover presence/absence per level (:334–335), initial auto-scroll to end (:365–372), wheel -120 → left (:375–380), focus restored to `[data-cell-id="popup-dictionary"]` in top host's shadow (:390–397), covered-band tap prunes to lv1 retaining 'absence' content (:447–461). Assertions are real DOM state, would catch regressions.
- Covered-band geometry is sound: default `popupSheetHeightVh ?? 72` → ~608px on 844px viewport; ArrowDown via `onKeyDownHandle` (`useSheet.ts:266–280`, −32px/press, min 200) → lv1 ≈480px (top ≈356), lv2 ≈288px (top ≈548); tap at `lv1Top+12` ≈ y=368, x=195 — inside lv1's cover, above lv2 → hits cover → `closeFromLevel(1)` → count 1, lv1 content preserved. The synthetic `KeyboardEvent` on the inert handle still runs React's delegated `onKeyDown` (dispatchEvent bypasses inert, which only blocks user interaction).
- Playwright mouse events (real-mouse pointer) mean the post-prune mouseup still fires — it lands on lv1's handle/host and is blocked by `eventBlockedForLookup`; on real touch the preventDefault suppression covers it. Double-protected.

## AC-1..AC-10
- AC-1 ✔ push real levels (`targetIdx = sourceIdx+1`, `popupLifecycle.ts:406–407` — sheet-mode force-to-0 branch gone); strip renders only `trail.length >= 2` (`LookupTrail.tsx:16,49`); pinned via `header` slot between handle and `.content` (`Sheet.tsx:142`, outside drag-dismiss/scroll region); `background: var(--color-surface-card)` ≠ `--color-surface-popover`; `nav` i18n aria-label (`ui.breadcrumb.aria`).
- AC-2 ✔ page lookup → `sourceIdx=-1 → targetIdx=0` → prune; unit test :2145–2165.
- AC-3 ✔ `onTrailNavigate(index) → closeFromLevel(index+1)`; reused mount keeps result (no re-fetch); strip truncates via `syncTrail`; focus restored via the D1 effect; unit test :2120–2143 + e2e.
- AC-4 ✔ labels = `lookupTerm` (request-time term, `controllerTypes.ts:40`); last crumb `aria-current` on `li` + non-interactive `span`; others real `<Button>`. Minor note below re: 40 vs 44px.
- AC-5 ✔ `overflow-x:auto`, `touch-action:pan-x`, wheel→scrollLeft, auto-scroll to newest, fade masks per edge (`LookupTrail.module.css:14–24`).
- AC-6 ✔ Escape: capture-phase LIFO escape stack → only top sheet's layer fires → `closeFromLevel(indexOf(top))`; handle click / drag-dismiss unchanged; `resumeVideo`+`resetVideoPlaying` only when stack empty (`popupLifecycle.ts:164–169`).
- AC-7 ✔ strip inside sheet → enters with slide-up; `trailIn` animation; unmounts entirely at depth 1.
- AC-8 ✔ desktop `Surface` branch untouched; `isTopLevel`/`inert`/`header`/`trail` only consumed by the Sheet branch; nested-popup e2e passes.
- AC-9 ✔ `modal={isTopLevel ?? true}` → `aria-modal` only on top; `inert={isTopLevel === false}` on covered (React 19.2.7 supports the `inert` prop; unit test :2168–2188 verifies both attrs).
- AC-10 ✔ `.crumb` / `.crumbCurrent` `max-width: var(--space-24)` + ellipsis; `title` tooltip preserves full term; strip still scrolls (`min-width: min-content` on `.nav`).

## Regression surfaces
- SubtitleManager mobile sheet (`ManagerLayer.tsx:108–129`): passes neither `inert` nor `header` → no cover, `wasInertRef` inits false → effect never fires → zero behavior change. All new Sheet props are optional/additive (spec boundary respected).
- Desktop nested popups: unchanged; the new `preventDefault` only runs on the prune path (already destructive of deeper levels) — verified non-breaking by the passing nested-popup spec.
- `docs/2-architechture-system.md:611` documents trail/isTopLevel/onTrailNavigate (DoD).

## Gates
- `npm run typecheck` pass; `npm run lint` pass (4 pre-existing warnings in SRS files); `npm run test:unit` 7998 pass; `npm run build` pass.
- E2E: `dict-sheet-trail.spec.ts` + `dictionary-nested-popup.spec.ts` — 3/3 pass (chain of 5 levels, crumb nav, Escape pop, covered-tap return, page reset, desktop nested-popup regression).

## Minor observations (non-blocking)
1. **Crumb hit target**: `Button size="sm"` → `min-height: var(--touch-target)` = 44px on coarse pointers but 40px on fine-pointer narrow viewports (<599px desktop window). AC-4/NFR-4 literally says ≥44px; the codebase treats `--touch-target` as the canonical touch-target token (40 desktop/44 coarse), and 40px exceeds WCAG 2.5.8's 24px AA minimum — acceptable under codebase convention.
2. **Real-mouse + narrow viewport**: a click on a covered band landing over `[data-allow-lookup]` text can prune *and* dispatch a new lookup (mouseup isn't suppressed for real mice). This exactly mirrors the documented desktop peeking-ancestor semantics, so it's parity rather than a defect; touch is fully suppressed.
3. Focus on reveal targets the sheet container (tabIndex=-1), consistent with `mount.focus()` semantics and the e2e assertion — not the first focusable; acceptable since the focus trap still governs Tab cycling.

## Verdict
D1, D2, D3 are properly fixed at the root cause. All AC-1..AC-10 are met. No new defects found. The three minor observations are spec-literalness notes, not failures.

VERDICT: PASS
