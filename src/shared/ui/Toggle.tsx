import { type ReactElement } from 'react';
import styles from './Toggle.module.css';

type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleProps {
  /** Current checked state */
  checked: boolean;
  /** Called when toggle state changes */
  onChange: (next: boolean) => void;
  /** Accessibility label for screen readers */
  ariaLabel: string;
  /** Size. Default: md. */
  size?: ToggleSize;
  /** Optional HTML id */
  id?: string;
  /** Optional data-testid for testing */
  dataTestId?: string;
  /** Optional title attribute */
  title?: string;
  /** Optional form field name */
  name?: string;
  /** When true, toggle is disabled (not clickable, dimmed). */
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
  size = 'md',
  id,
  dataTestId,
  title,
  name,
  disabled,
}: ToggleProps): ReactElement {
  return (
    <button
      type="button"
      id={id}
      data-testid={dataTestId}
      name={name}
      className={`${styles.toggle} ${styles[size]}`}
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
