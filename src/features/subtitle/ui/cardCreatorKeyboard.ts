/**
 * Card Creator keyboard shortcuts — pure functions (spec §9).
 *
 * `q` → quick update. `e` → edit (open dialog).
 *
 * Guards (per spec §9):
 *  - Not typing in an input/textarea/contenteditable.
 *  - Card Creator dialog not open (caller checks `dialogOpen`).
 *  - Video focused / subtitle block active (caller checks).
 *  - e.repeat ignored (no auto-repeat).
 */
import { isEditableTarget } from './subtitleShortcuts';

/** Card Creator keyboard action. */
export type CardCreatorKeyAction = 'quick-update' | 'edit-card';

/** Result of a keyboard event handler. */
export interface CardCreatorKeyResult {
  readonly action: CardCreatorKeyAction | null;
}

/**
 * Handle keydown for Card Creator shortcuts (q / e).
 *
 * @param e - The keyboard event.
 * @param dialogOpen - Whether the Card Creator dialog is currently open
 *                     (shortcuts disabled while open to avoid stealing keys).
 * @returns Result with the action to perform, or null.
 */
export function handleCardCreatorKeydown(
  e: KeyboardEvent,
  dialogOpen: boolean,
): CardCreatorKeyResult {
  // Guard: dialog open → no action (let dialog handle keys).
  if (dialogOpen) return { action: null };

  // Guard: typing in input/textarea → no action.
  if (isEditableTarget(e.target)) return { action: null };

  // Guard: auto-repeat → no action.
  if (e.repeat) return { action: null };

  switch (e.key) {
    case 'q':
    case 'Q':
      return { action: 'quick-update' };
    case 'e':
    case 'E':
      return { action: 'edit-card' };
    default:
      return { action: null };
  }
}
