import type { ToastOptions } from './subtitleUI';

/**
 * Create a trailing-debounced toast wrapper (ADR-015).
 *
 * Rapid calls within `delayMs` collapse into a single toast showing the
 * most recent message + variant. This prevents spam when the user rapidly
 * switches subtitles or imports multiple files in quick succession.
 *
 * Pure factory — returns a debounced function. Does not depend on the
 * underlying `showToast` implementation, so it can wrap the existing
 * `showToast` from `subtitleUI.ts` without modifying it.
 *
 * @param showToast - Base toast function `(message, container, options?) => void`
 * @param delayMs - Debounce delay in milliseconds (default 500)
 * @returns Debounced toast function
 */
export function createDebouncedToast(
  showToast: (message: string, container: HTMLElement, options?: ToastOptions) => void,
  delayMs = 500,
): (message: string, container: HTMLElement, options?: ToastOptions) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastMessage: string | null = null;
  let lastContainer: HTMLElement | null = null;
  let lastOptions: ToastOptions | undefined;

  return (message: string, container: HTMLElement, options?: ToastOptions): void => {
    lastMessage = message;
    lastContainer = container;
    lastOptions = options;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      if (lastMessage !== null && lastContainer !== null) {
        showToast(lastMessage, lastContainer, lastOptions);
      }
      timeoutId = null;
    }, delayMs);
  };
}
