import { type ReactElement } from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  /** Current checked state */
  checked: boolean;
  /** Called when toggle state changes */
  onChange: (next: boolean) => void;
  /** Accessibility label for screen readers */
  ariaLabel: string;
  /** Optional HTML id */
  id?: string;
  /** Optional data-testid for testing */
  dataTestId?: string;
  /** Optional title attribute */
  title?: string;
  /** When true, toggle is disabled (not clickable, dimmed). */
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
  id,
  dataTestId,
  title,
  disabled,
}: ToggleProps): ReactElement {
  return (
    <button
      type="button"
      id={id}
      data-testid={dataTestId}
      className={styles.toggle}
      aria-pressed={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}
