/**
 * Create a trailing-debounced toast wrapper (ADR-015).
 *
 * Rapid calls within `delayMs` collapse into a single toast showing the
 * most recent message. This prevents spam when the user rapidly switches
 * subtitles or imports multiple files in quick succession.
 *
 * Pure factory — returns a debounced function. Does not depend on the
 * underlying `showToast` implementation, so it can wrap the existing
 * `showToast` from `subtitleUI.ts` without modifying it.
 *
 * @param showToast - Base toast function `(message, container) => void`
 * @param delayMs - Debounce delay in milliseconds (default 500)
 * @returns Debounced toast function
 */
export function createDebouncedToast(
  showToast: (message: string, container: HTMLElement) => void,
  delayMs = 500,
): (message: string, container: HTMLElement) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastMessage: string | null = null;
  let lastContainer: HTMLElement | null = null;

  return (message: string, container: HTMLElement): void => {
    lastMessage = message;
    lastContainer = container;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      if (lastMessage !== null && lastContainer !== null) {
        showToast(lastMessage, lastContainer);
      }
      timeoutId = null;
    }, delayMs);
  };
}
