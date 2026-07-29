import { useEffect, useCallback, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Trap focus inside a shadow-root panel.
 *
 * Listens for `Tab`/`Shift+Tab` on the shadow root (capture), then cycles
 * focus among focusable descendants of `panel`. Uses `getRootNode().activeElement`
 * because `document.activeElement` does not pierce the shadow boundary.
 */
export function useShadowFocusTrap(panelRef: RefObject<HTMLElement | null>): void {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;

    const root = panel.getRootNode() as Document | ShadowRoot;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = root.activeElement as HTMLElement | null;

    const isWrappingBack = event.shiftKey;
    if (isWrappingBack) {
      if (!active || active === first || !focusable.includes(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (!active || active === last || !focusable.includes(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  }, [panelRef]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const root = panel.getRootNode() as Document | ShadowRoot;
    root.addEventListener('keydown', handleKeyDown as EventListener, true);

    return () => {
      root.removeEventListener('keydown', handleKeyDown as EventListener, true);
    };
  }, [handleKeyDown, panelRef]);
}
