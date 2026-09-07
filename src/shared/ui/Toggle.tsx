import { type ReactElement, useId } from 'react';
import styles from './Toggle.module.css';

type ToggleSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ToggleProps {
  /** Current checked state */
  checked: boolean;
  /** Called when toggle state changes */
  onChange: (next: boolean) => void;
  /** Accessibility label for screen readers */
  ariaLabel: string;
  /** Size. Default: xs. */
  size?: ToggleSize;
  /** Optional HTML id */
  id?: string;
  /** Optional data-cell-id for testing */
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
  size = 'xs',
  id,
  dataTestId,
  title,
  name,
  disabled,
}: ToggleProps): ReactElement {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  const className = `${styles.toggle} ${styles[size]} ${
    checked ? styles.checked : ''
  } ${disabled ? styles.disabled : ''}`;

  return (
    <label
      className={className}
      htmlFor={inputId}
      title={title}
    >
      <input
        id={inputId}
        data-cell-id={dataTestId}
        className={styles.input}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          if (disabled) return;
          onChange(e.target.checked);
        }}
      />
      <svg
        className={styles.thumb}
        viewBox="0 0 18 18"
        preserveAspectRatio="xMidYMid meet"
      >
        <circle cx="9" cy="9" r="9" />
      </svg>
    </label>
  );
}
