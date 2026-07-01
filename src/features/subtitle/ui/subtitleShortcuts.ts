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
 * @param key - Lowercase key from KeyboardEvent.key.toLowerCase()
 * @param shortcuts - User-configured shortcut bindings
 * @param target - Event target (to check if editable)
 * @returns Matching ShortcutAction, or null if no match / editable target
 */
export function handleShortcutKey(
  key: string,
  shortcuts: KeyboardShortcut[],
  target: EventTarget | null,
): ShortcutAction | null {
  if (isEditableTarget(target)) {
    return null;
  }
  const match = shortcuts.find((s) => s.key === key);
  return match ? match.action : null;
}
