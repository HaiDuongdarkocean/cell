import { useRef, type KeyboardEvent } from 'react';
import styles from './ShortcutInput.module.css';

/** Shortcut value — single key + optional modifiers (ADR-021 D7 combo support). */
export interface ShortcutValue {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
}

interface ShortcutInputProps {
  /** Current shortcut value (key + optional modifiers). */
  value: ShortcutValue;
  /** Called with the new shortcut when user presses a key. */
  onChange: (shortcut: ShortcutValue) => void;
  /** Accessible label (required — pill has no visible label). */
  'aria-label': string;
  /** Test ID. */
  'data-testid'?: string;
  /** HTML id for label association. */
  id?: string;
}

/** Modifier keys that should not be captured as the final key (only as modifiers). */
const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'controlleft', 'shiftleft', 'altleft', 'metaleft', 'controlright', 'shiftright', 'altright', 'metaright']);

/** Display label for a modifier. */
function modifierLabel(mod: 'ctrl' | 'shift' | 'alt'): string {
  if (mod === 'ctrl') return 'Ctrl';
  if (mod === 'shift') return 'Shift';
  return 'Alt';
}

/** Normalize a KeyboardEvent.key to a lowercase shortcut key. */
function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  // Arrow keys → readable names
  if (lower === 'arrowleft') return 'arrowleft';
  if (lower === 'arrowright') return 'arrowright';
  if (lower === 'arrowup') return 'arrowup';
  if (lower === 'arrowdown') return 'arrowdown';
  // Space → 'space'
  if (key === ' ') return 'space';
  // Single char (letter, digit, symbol) → lowercase
  return lower;
}

/** Display label for a key (uppercase for single chars). */
function keyDisplayLabel(key: string): string {
  if (key === 'arrowleft') return '←';
  if (key === 'arrowright') return '→';
  if (key === 'arrowup') return '↑';
  if (key === 'arrowdown') return '↓';
  if (key === 'space') return '␣';
  return key.toUpperCase();
}

/**
 * ShortcutInput atom — pill-style input for keyboard shortcuts (ADR-021 D7).
 *
 * Supports both single-char (←/→/R/O/P) and combo (Ctrl+Shift+T) shortcuts.
 * All instances share the same min-width (pill radius-full) for visual alignment.
 * Captures keydown on focus — user presses a key (with optional modifiers) to set.
 *
 * Accessibility: `aria-label` required, focus-visible ring, role="button".
 */
export function ShortcutInput({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: ShortcutInputProps): React.JSX.Element {
  const pillRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    // Ignore pure modifier presses (user holding Ctrl/Shift/Alt)
    if (MODIFIER_KEYS.has(e.key.toLowerCase())) return;
    const key = normalizeKey(e.key);
    if (!key) return;
    onChange({
      key,
      ctrl: e.ctrlKey || undefined,
      shift: e.shiftKey || undefined,
      alt: e.altKey || undefined,
    });
  };

  const hasCombo = value.ctrl || value.shift || value.alt;
  const modifiers: ('ctrl' | 'shift' | 'alt')[] = [];
  if (value.ctrl) modifiers.push('ctrl');
  if (value.shift) modifiers.push('shift');
  if (value.alt) modifiers.push('alt');

  return (
    <div
      ref={pillRef}
      id={id}
      role="button"
      tabIndex={0}
      className={styles.shortcutPill}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {hasCombo ? (
        <>
          {modifiers.map((mod) => (
            <span key={mod} className={styles.kbdModifier}>{modifierLabel(mod)}</span>
          ))}
          <span className={styles.kbdKey}>{keyDisplayLabel(value.key)}</span>
        </>
      ) : (
        <span className={styles.kbdSingle}>{keyDisplayLabel(value.key)}</span>
      )}
    </div>
  );
}
