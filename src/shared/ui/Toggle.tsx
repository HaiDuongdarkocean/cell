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
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
  id,
  dataTestId,
  title,
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
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}
