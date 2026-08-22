# ADR: OCR Region Overlay — Node Reuse + Token-Driven Class CSS

**Date:** 2026-08-22
**Status:** Accepted

## Context

Browser-testing the Custom Region Selector on kisskh.ovh exposed two defects and one styling debt in `regionSelector.ts`:

1. **Handles went dead after the first drag.** `render()` ran on every `mousemove` and recreated all 8 resize handles (and the Apply/Cancel buttons, and the label). Listeners were bound in `attachListeners()`, which only runs on `attach()`/`setMode()` — so after any drag re-rendered the handles, the new nodes had no `mousedown` listeners. Real user flow "enter edit → drag to move → drag a handle to resize" silently broke: the resize worked only if it was the very first interaction after entering edit mode.

2. **OCR session never auto-restored after reload on SPA sites.** `initOcrForCurrentUrl()` ran once at content-script load; on kisskh (Angular) the `<video>` mounts seconds later, so `findVideoElement()` returned null and OCR never started — the saved custom region existed in storage but never appeared on screen until the user toggled something.

3. **Styling debt.** Buttons/label were styled with inline `cssText` (no hover, no transition), colors were hardcoded per element (`#aa0000` Cancel), and the label showed raw drag decimals (`29.72222222222222%`). Panel icons were semantically wrong (`gauge` for scan height, `image` for OCR detection, `pencil` for move+resize).

## Decision

- **`render()` must update, never recreate**: label text is updated in place; handles are created once on entering edit mode with the `mousedown` listener bound at creation (their `%`-anchored CSS positions track rect resizes for free); the toolbar rebuilds only when crossing the view↔interactive boundary. `removeListeners()` no longer touches handles — they die with their node on `detach()`. A regression test (`regionSelector.test.ts`, "resize handles stay live AFTER a move drag") guards this contract.
- **Shared `videoReady.ts` + observer**: `isVideoReady()`/`hasRealChildSrc()` moved from `content-script.ts` to `src/shared/lib/dom/videoReady.ts` (SSOT). `ocrContentScript.ts` gains a MutationObserver (`childList + subtree + attributeFilter:['src']`) that waits for a READY video — the same ADR-012 two-phase gate the subtitle overlay uses, so the OCR overlay is never injected during the SPA template phase — then retries `initOcrForCurrentUrl()` once. The observer disconnects as soon as the session starts, OCR is disabled, or the origin changes.
- **Class-based CSS from tokens**: one injected `<style id="cell-ocr-region-style">` carries all overlay styling (class `.cell-ocr-region-*`). Colors/radius/font come from `STATIC_TOKENS` (`--overlay-ocr-region-accent/-fill/-fill-active` added to `tokens.json`, `--radius-pill`, `--font-family`) — resolved values, because the overlay runs on the host page where `tokens.css` vars don't exist. Hover/active states and the universal-panel hide rule live in the same stylesheet. Buttons are pill-shaped with `check`/`x` icons from `ICON_CATALOG`; percentages are rounded via `formatPct()`.
- **Contextual panel icons** (new catalog entries, lucide paths): `scanText` (detect burned-in subtitles), `moveVertical`/`moveHorizontal` (scan height/width sliders), `crop` (Select Region), `move` (Edit).

## Consequences

- Overlay hover states now work (impossible with inline styles) and stay consistent with the design system without loading `tokens.css` into the host page.
- `data-mode` on the rect drives cursor/fill per mode via CSS instead of JS string swaps.
- The render loop no longer allocates DOM nodes per mousemove frame (previously 8 handles + 2 buttons + 1 label per frame).
- `formatPct()` is shared by overlay label and settings panel so both always display the same rounded numbers.
