# ADR-055: Orbital Dictionary Pointer (Badge Pointer Trigger)

## Context

The Popup Dictionary already supports web-text triggers (`click`, `hover`, `hover-ctrl`, `hover-shift`, `hover-alt`) and subtitle-token triggers. On touch-first devices and fullscreen video, those triggers are awkward:

- **Hover** does not exist on touchscreens.
- **Text selection** on mobile video is imprecise and conflicts with player controls.
- **Modifier keys** are unavailable on tablets/phones.

Learners watching fullscreen video on a tablet or phone need a one-handed way to point at a word and look it up without leaving the video surface.

## Decision

Add an optional **Orbital Dictionary Pointer** (internally `badgePointerTrigger`) as a value of `DictionaryPopupSettings.triggerMode` (`'orbital'`). It is mutually exclusive with the click/hover trigger modes: only one mode is active at a time.

### D1 — UI shape and behavior

- A **crescent/half-moon badge** starts on the right **content edge**, vertically centered. The badge is a full circle centered at `document.documentElement.clientWidth` (with `window.innerWidth` fallback) so the content viewport clips the right half; the visible part is a clean half-moon that stays out from behind a vertical scrollbar.
- Dragging the badge pulls it away from the edge and reveals the full circle. When the badge is released within the snap radius (`badge_radius + 12 px`) of any content edge, it **collapses back to a crescent on that edge**, keeping its tangential position. Dragging a collapsed crescent along the edge repositions it; dragging it inward expands it again.
- A small **"moon" pointer** orbits the badge center and points toward the viewport. When the badge is collapsed to a half-moon on a viewport edge, the pointer is centered inside the visible half-moon (inset by `badge_size/4`) so it stays visible and is not clipped by the edge. When expanded, the pointer follows the user-selected preset. The pointer snaps to one of five presets: `top`, `bottom`, `left`, `right`, `center`.
- Pointer is kept **just outside the badge edge** when expanded: `offset = badge_radius + pointer_radius + 4px gap`.
- Pointer size scales with badge size through a configurable `pointerScale` (default **0.25**).
- Badge size is configurable from **24 px to 96 px** (default **36 px**).
- Animations (badge reveal, pointer snap) use **200 ms** CSS transitions.
- The badge + pointer always render on top: `z-index: 2147483647`.

### D2 — Preset selection

- The pointer keeps the user-selected preset when the badge expands or after a drag; it does **not** auto-rotate toward the viewport center.
- **Double-tap** on the expanded badge cycles the pointer preset forward through `center → right → top → left → bottom → center`.
- **Triple-tap** cycles the pointer preset backward through the same order.
- When the badge collapses against an edge, the local preset is set to point inward from that edge (e.g. right edge → `left`, top edge → `bottom`) without persisting, so the next expansion is ready to read content. The user-selected preset is persisted to `chrome.storage.local` via `orbitalBadgeStore` when the user explicitly double/triple taps or drags.

### D3 — Lookup resolution

- While the badge is expanded and the pointer is moving, a **debounced hover lookup** fires when the pointer stops for ~150 ms. It reuses `WebTriggerController.processPoint` so geometry checks (`isPointOverRange`), last-term dedup, and `LookupRequest` construction are identical to the hover trigger.
- On `pointerup` after drag, an immediate lookup is also attempted for the same pointer tip.
- Every pointer move while expanded also fires `onTipMoving` so the consumer can temporarily hide the popup if it covers the pointer or badge, keeping the target text readable during the drag.
- `WebTriggerController.processPoint` uses `caretRangeFromPoint` to find the text node under the tip, then `extractSentenceContext` + `isPointOverRange` to confirm the pointer is actually over the word geometry.
- The resolved `Range` is passed to `WebTextDictionaryController.handleLookup` so highlighting and popup behavior are identical to hover/click lookups.

### D4 — Fullscreen support

- The badge attaches to `document.body` by default.
- On `fullscreenchange`, it re-parents itself to `document.fullscreenElement ?? document.body` so it stays visible over fullscreen video.

### D5 — Settings integration

- The orbital badge is **always active when the dictionary popup is enabled**. It is not a separate `triggerMode`; instead it complements the existing click/hover triggers on devices where text selection is awkward.
- `DictionaryPopupSettings` keeps `badgePointerTrigger: { position: PointerPreset; size: number; pointerScale: number }` (no `enabled` field — the badge mounts whenever `dictionaryPopup.enabled` is true).
- Settings schema version advanced to **17** and then **18**; the v16→v17 migration removed the temporary `'orbital'` `triggerMode` value (migrating any stored `'orbital'` back to `'click'`) and made the badge always-on.
- The Options page shows the pointer-position select and badge-size input in `DictionaryPopupSettingsPanel` whenever the dictionary popup is enabled.

### D6 — Architecture

- Implementation lives in `src/features/dictionaryPopup/badgePointer/` (geometry/gesture helpers) and `src/features/dictionaryPopup/ui/OrbitalBadge.tsx` (React component).
- `OrbitalBadge` is a React component rendered into a Shadow DOM host by `mountOrbitalBadge.ts`. It uses `useOrbitalPointer`, `useOrbitalSnap`, and `useOrbitalGesture`.
- `WebTextDictionaryController` owns the badge lifecycle: creates/destroys it from `syncOrbitalBadge`/`updateSettings` and `destroy`, routes `onTipReady` to `handleLookup`, and persists preset changes via `orbitalBadgeStore`.

### D7 — Popup repositioning and pointer-aware placement

- `WebTriggerController` temporarily disables `pointer-events` on `.js-cell-popup-host` and `.js-cell-orbital-badge-host` (and recursively on their Shadow DOM children) while calling `caretRangeFromPoint` so the popup or pointer itself never blocks the next lookup.
- `WebTriggerController` forwards the pointer tip, optional badge center, badge radius, and pointer radius to `onLookup`; `WebTextDictionaryController` passes this hint through `showPopup` to `PopupShell`.
- `PopupShell.computePopupPosition` scores all four sides (below, above, right, left) with the pointer hint. The preferred side is the direction the pointer is coming from (away from the badge). Each candidate is clamped to the viewport and scored by clamp distance and by whether it would cover the pointer tip (treated as a circle with `pointerRadius`), the badge circle (`badgeRadius`), or the lookup token; the lowest score wins. This keeps the popup from obscuring the badge, pointer, or looked-up text even when screen space is tight.
- `OrbitalBadge` fires `onTipMoving` on every pointer move while the badge is expanded. `WebTextDictionaryController` uses it to hide the popup when the moving pointer or badge would overlap the visible popup, keeping the target line readable while the user drags the pointer to a new word.
- When the badge is collapsed against an edge it temporarily uses an inward-pointing preset (`left` for a right-edge collapse, etc.). The user-selected preset is stored separately and is restored when the badge expands again, so dragging the badge out always resumes the user's chosen pointer direction.
- `WebTriggerController` remembers the last looked-up word occurrence. It re-dispatches the lookup (so the popup can reposition) when the same term appears at a different offset or pointer location, but skips duplicates when the cursor stays on the exact same word with only a tiny movement.
- The popup CSS transitions on `left`/`top` so repositioning between lookup targets animates smoothly.

## Consequences

- **Learner**: one-handed lookup on mobile/tablet and fullscreen video becomes possible without text selection or modifier keys.
- **Controller coupling**: `WebTextDictionaryController` gains a small amount of badge-management code. It was chosen over a separate controller because the lookup + highlight + popup path is already centralized there, and the badge is just another input source.
- **Touch interference**: the badge must ignore its own elements during hit-testing, otherwise the pointer can look up parts of the badge itself.
- **Z-index**: the badge is capped at the maximum 32-bit signed integer to stay above most host-page overlays and video controls.
- **Backward compat**: disabled by default; existing trigger modes are unchanged. Settings migration is additive.

## Alternatives considered

- **Variant A: long-press on video subtitle text**: rejected — not all sites expose selectable text, and long-press timing conflicts with native player controls.
- **Variant B: floating action button with crosshair overlay**: rejected — a crosshair obscures the word; an orbiting pointer keeps the target visible.
- **Variant C: dedicated controller for the badge**: rejected — it would duplicate the lookup/highlight orchestration already in `WebTextDictionaryController`. Keeping it inline makes the badge just another trigger source.
- **Variant D (chosen)**: inline badge + pointer module owned by `WebTextDictionaryController`, reusing existing lookup and highlight paths.
