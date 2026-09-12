# ADR-101: Keyboard event ownership between host page and Cell UI

**Status:** Accepted  
**Date:** 2026-09-12  
**Author:** Cell team  

## Context

Cell injects its UI into host pages using shadow DOM content scripts (universal panel, dictionary popover, settings dialogs, subtitle manager, etc.). Cell also registers global `window` `keydown`/`keyup` listeners in the capture phase so its own shortcuts run before host-page shortcuts (e.g. YouTube `t` and Space handling).

Three interaction modes were colliding:

1. **Host shortcuts firing while a Cell panel is focused.**
   The user intends a Cell action or typing, but the host page also has a listener for the same key.
2. **Cell shortcuts firing while the user is typing in a Cell input.**
   Shadow DOM `event.target` is retargeted to the shadow host, so `isEditableTarget(e.target)` returned `false` and `handleShortcutKey` could match keys like `c` or `t` while the dictionary search input had focus.
3. **Buttons/links not activating with Enter/Space because Cell was swallowing activation keys.**
   Cell needs to let buttons and links keep their native keyboard activation behavior while still preventing host shortcuts.

## Decision

### 1. Resolve the real event target with `composedPath()`

`KeyboardEvent.target` is retargeted to the shadow host when focus is inside a shadow root. Use `e.composedPath()[0]` (falling back to `e.target`) to obtain the actual focused element.

This applies to:

- `isEditableEvent(e)` — checks whether the real target is an `input`, `textarea`, `select`, or `contenteditable` element.
- `handleShortcutKey(key, shortcuts, target, modifiers)` — now receives the real target so it correctly skips shortcuts when focus is in an editable control.
- `isActivatableTarget(target)` — a new shared helper that identifies `button`, `a`, or `[role="button"]` elements.

### 2. Allow Cell shortcuts to win while a Cell panel has focus

In `contentScriptController.ts`, configured shortcuts are no longer disabled just because focus is inside a Cell UI host. If a shortcut matches while a panel is focused, Cell executes it and stops propagation so the host cannot run the same key.

Guards that still apply:

- Skip shortcuts when `isEditableEvent(e)` is `true` (typing must work).
- Skip activation keys (`Enter` / `Space`) on activatable controls unless Player Mode is active, so buttons and links keep their native click behavior.
- Player Mode continues to own the keyboard; activation-key bypass does **not** apply there.

### 3. Block host shortcuts for unhandled keys inside Cell UI

If no shortcut matches while focus is inside a Cell panel, the `contentScriptController` still calls `e.stopImmediatePropagation()` for non-`Escape` keys so the host page does not react. `e.preventDefault()` is **not** called in this path, so activatable controls and browser default behaviors (e.g. button click on Space/Enter) are preserved.

`Escape` is always allowed through so panels can close via their own `onKeyDown` handlers or the shared `escapeLayerStack`.

### 4. Cell UI roots trap remaining keyboard events

Some events must not stop at the `contentScriptController` (e.g. when focus is in an input and `contentScriptController` intentionally lets the event pass). To prevent those events from bubbling to the host page, Cell UI root containers now stop non-`Escape` keyboard events:

- `Surface` — panels, dialogs, popovers, cards.
- `Sheet` — mobile bottom sheets (manager, dictionary popup).
- `ManagerLayer` desktop `.panelLayer` — subtitle manager overlay.

These handlers call the consumer’s `onKeyDown`/`onKeyUp` first and then `e.stopPropagation()` for non-`Escape` keys.

### 5. Keyup is blocked too

`contentScriptController` mirrors the keydown logic in the `keyup` listener:

- Skip editable and activatable+activation events.
- Stop the host for matched configured shortcuts.
- Stop the host for unhandled non-`Escape` keys inside Cell UI.

This prevents double-toggles such as YouTube pausing on `keyup` after Cell already paused on `keydown`.

## Consequences

- Focus inside a Cell UI surface: Cell shortcuts take precedence; host shortcuts are blocked.
- Focus inside a Cell input/textarea/select: typing works, and neither Cell nor host shortcuts fire.
- Enter on the dictionary search input submits the lookup because `SearchField` handles `Enter` and the `Surface` wrapper does not block it.
- Buttons and links inside Cell UI still activate with Enter/Space.
- Player Mode continues to receive its own shortcuts and blocks host shortcuts.

## Verification performed

```bash
npm run lint                    # pass
npx tsc --noEmit                # pass
npx jest --selectProjects unit  # pass
npm run build                   # pass
npx playwright test --config=playwright.stream.config.ts \
  e2e/stage2/universal-panel-keyboard.spec.ts --project=chromium  # pass
```

Relevant unit tests:

- `tests/unit/features/subtitle/ui/subtitleShortcuts.test.ts` — `isEditableEvent`, `isActivatableTarget`, `handleShortcutKey` guard behavior.
- `src/features/subtitle/ui/contentScriptController.test.ts` — shortcut precedence inside Cell UI, editable input bypass, activatable control bypass, host blocking without `preventDefault`.
