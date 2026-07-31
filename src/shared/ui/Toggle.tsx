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
  /** Size. Default: sm.
   *  Ponytail: sm is below the design-system --touch-target (40/44px).
   *  If coarse-pointer tap issues appear, default to md or add a pointer-coarse override. */
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
  size = 'sm',
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
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}
