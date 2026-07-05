// Keyboard shortcuts handler for subtitle floating panel.
// ponytail: pure function — no side effects, fully testable.
// ADR-005 D3: pure function in content script, guard input/textarea/contenteditable.

import type { KeyboardShortcut, ShortcutAction } from '@/entities/media';

/**
 * Check if the event target is an editable element (input, textarea, select,
 * or contenteditable). Shortcuts should NOT fire when focus is in these elements.
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
 * Map a pressed key to a shortcut action, guarding against editable targets.
 *
 * ADR-021 D7: supports combo matching (ctrl/shift/alt modifiers). Shortcuts
 * with matching key + matching modifiers win. Single-char shortcuts (no
 * modifiers) only match when no modifiers pressed (backward compat).
 *
 * @param key - Lowercase key from KeyboardEvent.key.toLowerCase()
 * @param shortcuts - User-configured shortcut bindings
 * @param target - Event target (to check if editable)
 * @param modifiers - Pressed modifier keys (ctrl/shift/alt) for combo matching
 * @returns Matching ShortcutAction, or null if no match / editable target
 */
export function handleShortcutKey(
  key: string,
  shortcuts: KeyboardShortcut[],
  target: EventTarget | null,
  modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean },
): ShortcutAction | null {
  if (isEditableTarget(target)) {
    return null;
  }
  const mCtrl = modifiers?.ctrl ?? false;
  const mShift = modifiers?.shift ?? false;
  const mAlt = modifiers?.alt ?? false;
  const match = shortcuts.find((s) => {
    if (s.key !== key) return false;
    const sCtrl = s.ctrl ?? false;
    const sShift = s.shift ?? false;
    const sAlt = s.alt ?? false;
    return sCtrl === mCtrl && sShift === mShift && sAlt === mAlt;
  });
  return match ? match.action : null;
}
