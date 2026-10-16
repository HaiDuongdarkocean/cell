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
    // document.activeElement does not pierce the shadow boundary — inside a
    // shadow-root panel it returns the host, so the wrap check would never
    // match and focus would escape the modal. Read the panel's own root.
    const root = panel.getRootNode() as Document | ShadowRoot;
    const previouslyFocused = (root.activeElement ??
      document.activeElement) as HTMLElement | null;

    // Move focus into the panel — first *visible* focusable. The DOM-first
    // node can be display:none (e.g. the desktop-hidden bottom nav), where
    // .focus() no-ops and leaves focus outside the aria-modal dialog.
    // Skip role=separator (e.g. Sheet drag handle): programmatic .focus()
    // after a keyboard open still paints the UA focus ring on the splitter,
    // and users Tab to it explicitly anyway — it stays in the trap cycle.
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null || el === root.activeElement);
    const first =
      focusables.find((el) => el.getAttribute('role') !== 'separator') ?? focusables[0];
    if (first) {
      first.focus();
    } else if (panel.tabIndex >= 0) {
      panel.focus();
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === root.activeElement);
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (root.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (root.activeElement === lastEl) {
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
