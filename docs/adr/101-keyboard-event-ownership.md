# ADR-101: Keyboard event ownership between host page and Tihoka UI

**Status:** Accepted  
**Date:** 2026-09-12  
**Author:** Tihoka team  

## Context

Tihoka injects its UI into host pages using shadow DOM content scripts (universal panel, dictionary popover, settings dialogs, subtitle manager, etc.). Tihoka also registers global `window` `keydown`/`keyup` listeners in the capture phase so its own shortcuts run before host-page shortcuts (e.g. YouTube `t` and Space handling).

Three interaction modes were colliding:

1. **Host shortcuts firing while a Tihoka panel is focused.**
   The user intends a Tihoka action or typing, but the host page also has a listener for the same key.
2. **Tihoka shortcuts firing while the user is typing in a Tihoka input.**
   Shadow DOM `event.target` is retargeted to the shadow host, so `isEditableTarget(e.target)` returned `false` and `handleShortcutKey` could match keys like `c` or `t` while the dictionary search input had focus.
3. **Buttons/links not activating with Enter/Space because Tihoka was swallowing activation keys.**
   Tihoka needs to let buttons and links keep their native keyboard activation behavior while still preventing host shortcuts.

## Decision

### 1. Resolve the real event target with `composedPath()`

`KeyboardEvent.target` is retargeted to the shadow host when focus is inside a shadow root. Use `e.composedPath()[0]` (falling back to `e.target`) to obtain the actual focused element.

This applies to:

A shared module (`src/shared/lib/dom/isEditable.ts`) owns `isEditableTarget`, `isEditableEvent`, and `isActivatableTarget` so tokenize controllers, the iframe bridge, and the subtitle shortcut layer all use the same detection logic.

- `isEditableEvent(e)` — checks whether the real target is an `input`, `textarea`, `select`, or `contenteditable` element.
- `handleShortcutKey(key, shortcuts, target, modifiers)` — now receives the real target so it correctly skips shortcuts when focus is in an editable control.
- `isActivatableTarget(target)` — a shared helper that identifies `button`, `a`, or `[role="button"]` elements.
- `webTokenizeController`, `subtitleTokenizeController`, and `iframePlayerModeBridge` — now use `isEditableEvent(e)` instead of `isEditableTarget(e.target)`, so keys typed inside Tihoka inputs are no longer mis-classified as tokenize or player-mode shortcuts.

### 2. Allow Tihoka shortcuts to win while a Tihoka panel has focus

In `contentScriptController.ts`, configured shortcuts are no longer disabled just because focus is inside a Tihoka UI host. If a shortcut matches while a panel is focused, Tihoka executes it and stops propagation so the host cannot run the same key.

Guards that still apply:

- Skip shortcuts when `isEditableEvent(e)` is `true` (typing must work).
- Skip activation keys (`Enter` / `Space`) on activatable controls unless Player Mode is active, so buttons and links keep their native click behavior.
- Player Mode continues to own the keyboard; activation-key bypass does **not** apply there.

### 3. Block host shortcuts for unhandled keys inside Tihoka UI

If no shortcut matches while focus is inside a Tihoka panel, the `contentScriptController` still calls `e.stopImmediatePropagation()` for non-`Escape` keys so the host page does not react. `e.preventDefault()` is **not** called in this path, so activatable controls and browser default behaviors (e.g. button click on Space/Enter) are preserved.

`Escape` is always allowed through so panels can close via their own `onKeyDown` handlers or the shared `escapeLayerStack`.

### 4. Tihoka UI roots trap remaining keyboard events

Some events must not stop at the `contentScriptController` (e.g. when focus is in an input and `contentScriptController` intentionally lets the event pass). To prevent those events from bubbling to the host page, Tihoka UI root containers now stop non-`Escape` keyboard events:

- `Surface` — panels, dialogs, popovers, cards.
- `Sheet` — mobile bottom sheets (manager, dictionary popup).
- `ManagerLayer` desktop `.panelLayer` — subtitle manager overlay.
- `mountReactShadow` — every React tree mounted into a new shadow root gets a `keydown`/`keyup` bubble listener on the `ShadowRoot` that stops non-`Escape` events from leaving the shadow tree. This is the catch-all for surfaces that don't explicitly trap keys (e.g. the subtitle overlay where `SubtitlePractice` runs).

These handlers call the consumer’s `onKeyDown`/`onKeyUp` first and then call both `e.stopPropagation()` (so React parent handlers don't run) and `e.nativeEvent.stopImmediatePropagation()` (so the host page never sees the native event) for non-`Escape` keys.

### 5. Keyup is blocked too

`contentScriptController` mirrors the keydown logic in the `keyup` listener:

- Skip editable and activatable+activation events.
- Stop the host for matched configured shortcuts.
- Stop the host for unhandled non-`Escape` keys inside Tihoka UI.

This prevents double-toggles such as YouTube pausing on `keyup` after Tihoka already paused on `keydown`.

## Consequences

- Focus inside a Tihoka UI surface: Tihoka shortcuts take precedence; host shortcuts are blocked.
- Focus inside a Tihoka input/textarea/select: typing works, and neither Tihoka nor host shortcuts fire.
- Enter on the dictionary search input submits the lookup because `SearchField` handles `Enter` and the `Surface` wrapper does not block it.
- Buttons and links inside Tihoka UI still activate with Enter/Space.
- Player Mode continues to receive its own shortcuts and blocks host shortcuts.

## Verification performed

```bash
npm run typecheck               # pass
npm run test:unit               # pass
npm run build                   # pass
npx playwright test --config=playwright.stream.config.ts \
  e2e/stage2/universal-panel-keyboard.spec.ts \
  e2e/stage2/subtitle-panel-practice.spec.ts \
  e2e/stage2/study-modes.spec.ts --project=stage2  # pass
```

Relevant unit tests:

- `src/shared/lib/dom/isEditable.test.ts` — `isEditableEvent`, `isEditableTarget`, `isActivatableTarget` behavior, including `composedPath()` fallback.
- `tests/unit/features/subtitle/ui/subtitleShortcuts.test.ts` — re-exported `isEditableEvent`, `isActivatableTarget`, `handleShortcutKey` guard behavior.
- `src/features/subtitle/ui/contentScriptController.test.ts` — shortcut precedence inside Tihoka UI, editable input bypass, activatable control bypass, host blocking without `preventDefault`.
- `src/features/tokenize/controller/webTokenizeController.test.ts` and `src/features/tokenize/controller/subtitleTokenizeController.test.ts` — tokenize shortcuts do not fire while typing.
