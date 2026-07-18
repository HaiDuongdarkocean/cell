import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * useFocusTrap — WCAG AA focus management for modal dialogs/drawers/bottom sheets.
 *
 * On `open`:
 *   1. Records the currently focused element (restore target on close).
 *   2. Moves focus into the panel (first focusable element).
 *   3. Traps Tab/Shift+Tab cycling within the panel.
 *
 * On cleanup (close/unmount):
 *   4. Restores focus to the element that was focused before the panel opened.
 *
 * Why: screen reader + keyboard users must not Tab out of a modal into the
 * background page (aria-modal="true" promises focus is contained). Restoring
 * focus on close lets keyboard users resume where they left off.
 */
export function useFocusTrap(panelRef: RefObject<HTMLElement | null>, open: boolean): void {
  useEffect(() => {
    if (!open || !panelRef.current) return;

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the panel (first focusable element).
    const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    panel.addEventListener('keydown', handleKeyDown);

    return () => {
      panel.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the trigger element on close.
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
}
