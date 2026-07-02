// Nav cluster keyboard state machine — pure functions (ADR-018 D4, spec §F12).
// ponytail: pure, no side effects. Fixed parallel shortcuts (NOT in ShortcutAction union).
// R hold uses keydown/keyup state machine (ignore e.repeat, cancel on blur/visibilitychange).

import { isEditableTarget } from './subtitleShortcuts';

/** Cluster keyboard action emitted by the state machine. */
export type NavClusterKeyAction =
  | 'prev-sentence'
  | 'next-sentence'
  | 'repeat-start'
  | 'repeat-stop'
  | 'seek-rewind-5'
  | 'seek-forward-10';

/** Mutable keyboard state (R hold tracking). */
export interface NavClusterKeyboardState {
  repeatHolding: boolean;
}

/** Result of a keyboard event handler. */
export interface NavClusterKeyResult {
  readonly action: NavClusterKeyAction | null;
  readonly state: NavClusterKeyboardState;
}

/** Create initial keyboard state (R not holding). */
export function createInitialKeyboardState(): NavClusterKeyboardState {
  return { repeatHolding: false };
}

/**
 * Handle keydown for cluster shortcuts (ADR-018 D4).
 * Guards: editable target → no action. e.repeat → no action (ignore auto-repeat).
 * R hold: only starts if not already holding + not auto-repeat.
 */
export function handleClusterKeydown(
  e: KeyboardEvent,
  state: NavClusterKeyboardState,
): NavClusterKeyResult {
  if (isEditableTarget(e.target)) {
    return { action: null, state };
  }

  const key = e.key;

  switch (key) {
    case 'ArrowLeft':
      return { action: 'prev-sentence', state };
    case 'ArrowRight':
      return { action: 'next-sentence', state };
    case 'r':
    case 'R': {
      if (e.repeat || state.repeatHolding) {
        return { action: null, state };
      }
      return { action: 'repeat-start', state: { repeatHolding: true } };
    }
    case '<':
    case ',':
      return { action: 'seek-rewind-5', state };
    case '>':
    case '.':
      return { action: 'seek-forward-10', state };
    default:
      return { action: null, state };
  }
}

/**
 * Handle keyup for cluster shortcuts (ADR-018 D4).
 * R keyup when holding → repeat-stop. Other keys → no action (keep holding).
 */
export function handleClusterKeyup(
  e: KeyboardEvent,
  state: NavClusterKeyboardState,
): NavClusterKeyResult {
  const key = e.key;
  if ((key === 'r' || key === 'R') && state.repeatHolding) {
    return { action: 'repeat-stop', state: { repeatHolding: false } };
  }
  return { action: null, state };
}

/**
 * Cancel repeat hold (blur/visibilitychange — keyup may be lost).
 * Returns repeat-stop if was holding, else no action.
 */
export function cancelRepeatHold(state: NavClusterKeyboardState): NavClusterKeyResult {
  if (state.repeatHolding) {
    return { action: 'repeat-stop', state: { repeatHolding: false } };
  }
  return { action: null, state };
}
