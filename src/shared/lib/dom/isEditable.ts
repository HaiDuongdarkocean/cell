/**
 * Detect editable and activatable targets in a way that works across shadow
 * DOM boundaries. Keyboard events inside a shadow root are retargeted, so
 * `event.target` is the shadow host — use `event.composedPath()[0]` for the
 * real focused element.
 */

/**
 * Check if the target is an editable element (input, textarea, select,
 * or contenteditable). Shortcuts should NOT fire when focus is in these.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  // ponytail: check attribute directly — jsdom doesn't reflect isContentEditable
  // from the contenteditable attribute. In real browsers isContentEditable works,
  // but attribute check is more reliable across environments.
  return target.getAttribute('contenteditable') === 'true' || target.isContentEditable === true;
}

/**
 * Check if a keyboard event originated from an editable element, crossing
 * shadow DOM boundaries. `e.target` is retargeted to the shadow host when
 * focus is inside a shadow root, so `isEditableTarget(e.target)` returns
 * false even when the real focus is an `<input>`. Use `composedPath()[0]`
 * to see the actual element that has focus.
 */
export function isEditableEvent(e: KeyboardEvent): boolean {
  const realTarget = e.composedPath()[0] ?? e.target;
  return realTarget instanceof HTMLElement && isEditableTarget(realTarget);
}

/**
 * Check if the target is an activatable control (button, link, or
 * `role="button"`) where Enter/Space should trigger the control, not a
 * subtitle shortcut. Shortcuts like 'c' may still fire on these controls,
 * but activation keys (Enter/Space) are reserved for the control.
 */
export function isActivatableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a') {
    return true;
  }
  return target.getAttribute('role') === 'button';
}
