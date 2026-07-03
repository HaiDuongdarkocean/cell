// Nav cluster keyboard state machine — pure functions (ADR-018 D4, spec §F12).
// ponytail: pure, no side effects. Fixed parallel shortcuts (NOT in ShortcutAction union).
// R key now toggles the 3-state repeat cycle (idle → recording-end → looping → idle).

import { isEditableTarget } from './subtitleShortcuts';

/** Cluster keyboard action emitted by the state machine. */
export type NavClusterKeyAction =
  | 'prev-sentence'
  | 'next-sentence'
  | 'repeat-toggle'
  | 'seek-rewind-5'
  | 'seek-forward-10';

/** Mutable keyboard state (no R hold tracking; 3-state repeat is toggle on keydown). */
export interface NavClusterKeyboardState {
  /** Reserved for future stateful keyboard shortcuts. */
  _placeholder: boolean;
}

/** Create initial keyboard state. */
export function createInitialKeyboardState(): NavClusterKeyboardState {
  return { _placeholder: false };
}

/** Result of a keyboard event handler. */
export interface NavClusterKeyResult {
  readonly action: NavClusterKeyAction | null;
  readonly state: NavClusterKeyboardState;
}

/**
 * Handle keydown for cluster shortcuts (ADR-018 D4).
 * Guards: editable target → no action. e.repeat → no action (ignore auto-repeat).
 * R key: toggle 3-state repeat cycle (idle → recording-end → looping → idle).
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
      if (e.repeat) {
        return { action: null, state };
      }
      return { action: 'repeat-toggle', state };
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
 * 3-state repeat is toggle-on-keydown, so keyup has no action for R.
 */
export function handleClusterKeyup(
  _e: KeyboardEvent,
  state: NavClusterKeyboardState,
): NavClusterKeyResult {
  return { action: null, state };
}

/**
 * Cancel repeat hold (blur/visibilitychange — keyup may be lost).
 * 3-state repeat loop is not tied to key hold, so no action needed.
 */
export function cancelRepeatHold(state: NavClusterKeyboardState): NavClusterKeyResult {
  return { action: null, state };
}
