# Spec — Nested Dictionary Popup Stack

Status: draft → implementing
Owner feature: `src/features/dictionaryPopup/`

## Objective

Turn the single dictionary popup into a stack of nested popups. Clicking a word
inside a popup's lookup-enabled content (definitions, translations) opens a
**child** popup while ancestors stay visible. Clicking another word in the same
source context updates that level in place and moves it to the new anchor.

## Current behavior (baseline)

`webTextDictionaryController` owns exactly one `popupMount` plus one set of
per-lookup state (`currentHighlightTarget`, `originalHighlightTarget`,
`highlightAnchor`, `currentPopupTokenId`, `currentRequestId`, one shared
`wordHighlight`). In `renderLookupResult`, any fresh lookup destroys the
existing desktop popup before mounting the new one — so a lookup triggered
from inside level 1 replaces level 1.

## Target behavior

Let `source(target)` = index of the popup level whose shadow root contains the
lookup target (`Range.startContainer` / `HTMLElement`), or `-1` when the target
is page/subtitle text. `mount.host` is exposed on the mount handle for this.

| Interaction | Result |
|---|---|
| Click word on page/subtitle text | Level 1 updates in place (new term, repositioned). Levels ≥ 2 close. |
| Click word inside level N popup content (`data-allow-lookup`) | Levels > N+1 close. Level N+1 reuses its mount if present (setLoading → setResult → setAnchor), otherwise mounts fresh. Ancestors stay visible. |
| Click page/subtitle word while stack open | Same as first row: level 1 updates, deeper levels close. |
| Click inside popup chrome (header, padding, buttons, resize, links, `[data-no-lookup]`) | No lookup (blocked by trigger gating). No dismissal — the click is inside a stack host. |
| Click empty space / unrelated page region outside every stack host | Whole stack dismisses. |
| X / Esc on level N | Level N and all deeper levels close. Ancestors stay. |
| Level already exists at target index | Reuse it: `setLoading` → `setResult` → `setAnchor` (reposition). Never duplicate a level. |

Rules:

- `targetLevel = source + 1`, where `source = -1` for page text → `targetLevel = 0`.
- `MAX_DEPTH = 6` on desktop. Beyond the cap the deepest level reuses itself
  (`targetLevel = min(source + 1, MAX_DEPTH - 1)`).
- Sheet mode (`innerWidth < POPUP_SHEET_BREAKPOINT_PX`) keeps a single level —
  stack never exceeds 1, existing sheet-chaining behavior unchanged.
- Closing level N prunes all levels > N — a popup never outlives its parent
  chain.
- `destroy()` on a level clears its own highlight, token id, request id and
  unmounts it.

## State model

Replace single-popup state with `popupStack: PopupLevel[]`:

```ts
interface PopupLevel {
  mount: PopupDictionaryMountController;
  requestId: string | null;
  highlightTarget: HighlightTarget | null;
  originalHighlightTarget: HighlightTarget | null;
  highlightAnchor: { parent: Element; wordStart: number } | null;
  popupTokenId: { term: string; start: string; blockId: string } | null;
  highlight: WordHighlight; // createWordHighlight() per level
}
```

Global state that stays global: `lookupCache`, `popupDictWasPlaying`
(video pause), `popupDismissTimer`, `pendingLookup`, settings, orbital badge.

Level-scoped helpers (`expandHighlightForTerm`, `isLookupFromSubtitle`,
`setPopupTokenId`, `handlePopupStatusChange`, `expandHighlightForTerm`,
`prefetchAdjacentTerms`) take the owning level as a parameter.

## Async / stale-response rules

- Each level owns `requestId`. `handleLookup` assigns the request to its
  target level; the response handler resolves the level via
  `stack.find(l => l.requestId === requestId)`.
- Pruned/destroyed level → response ignored (level not found).
- `cancelInFlightLookup` cancels every live `level.requestId` on detach.
- `webTrigger.isCurrentRequestId` still gates trigger-side cancellation.

## Positioning

`PopupDictionaryMountController` gains `setAnchor(anchor, pointer?, lineRect?)`
which stores the geometry and bumps an `anchorVersion` passed through to
`Dictionary` → `usePopupPosition`. The hook watches `anchorVersion`; on change
it recomputes `position` from `computeAndClampPosition` with drag offset reset
to 0, so a reused popup moves to the new word. Initial mount behavior
unchanged. Sheet mode ignores anchors (Sheet is bottom-anchored).

## Outside-dismiss wiring

`MountPopupDictionaryOptions` gains:

- `host` exposure on the handle (readonly `HTMLElement`) for level detection.
- `isInsideOtherHost?: (e: PointerEvent) => boolean` — when true for an event
  outside its own host, the mount ignores it (click landed in a sibling popup).
- `onOutsidePointerDown?: () => void` — when provided it replaces `close()` for
  outside clicks; the controller routes it to close-the-whole-stack.
  Per-level `onClose` still prunes that level + descendants.

## Video

`pauseVideoIfNeeded` runs on first mount as today; `resumeVideoIfNeeded` only
runs when the stack becomes empty (close-all / dismiss), not when a single
nested level closes.

## Edge cases covered

- Same word re-clicked → same level updates, no new level.
- Click word in level N while deeper levels open → prune > N+1, reuse N+1.
- Click highlighted `.js-cell-token` inside definitions → re-lookup same level.
- Rapid clicks → stale responses dropped via per-level requestId.
- Viewport edges → `computePopupPosition` clamps per level; child anchor lives
  inside parent popup, placement picks the free side.
- Popup fullscreen reparenting stays per-mount (existing `reparentOnFullscreen`).
- `pointerdown` inside any stack host never dismisses a sibling.
- Non-text clicks inside popup (padding/gaps) hit the host → no lookup, no close.
- Empty result / failed lookup on a child level → that level shows the result
  state; ancestors unaffected.
- Close button mid-stack → level + descendants destroyed, ancestors stay.
- Media recording (`isLookupFromSubtitle`) evaluated against the level that
  issued the request.
- `updateSettings` broadcasts options to every live level.
- `syncStatus` updates every live level (same term may appear at depth > 1).

## Out of scope

- Visual connective lines between levels, level badges, rearranged layout.
- Nested stacking in sheet mode (capped at 1 by design).
- Persisting popup stack across page navigation.

## Testing strategy

- Unit: stack classification (page vs level N), prune rules, stale response
  discard, per-level highlight lifecycle, video pause/resume on stack-empty,
  `setAnchor` → `usePopupPosition` recompute.
- E2E (`e2e/stage2/`): lv1 from subtitle target → click word in definitions →
  both `.js-cell-popup-host` remain → click another word in lv1 → lv2
  still single child → outside click → stack gone. Reuse existing
  `cellEnvironment` fixture (headed Chrome, real `dist/`).

## Definition of done

- `npm run typecheck && npm run test:unit && npm run build` green.
- New unit + E2E coverage above passes; existing popup/subtitle specs pass.
- Verified in real Chrome via testing-extension-browser skill.
- `docs/2-architechture-system.md` updated for stack behavior.
- Atomic commit.
