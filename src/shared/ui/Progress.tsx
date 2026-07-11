import type { HTMLAttributes } from 'react';
import styles from './Progress.module.css';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Current value. */
  value?: number;
  /** Maximum value. Default: 100. */
  max?: number;
  /** Indeterminate animation. */
  indeterminate?: boolean;
}

/**
 * Progress — horizontal progress bar.
 */
export function Progress({
  value = 0,
  max = 100,
  indeterminate,
  className,
  ...rest
}: ProgressProps): React.JSX.Element {
  const percentage = max === 0 ? 0 : Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={[styles.root, indeterminate ? styles.indeterminate : '', className ?? ''].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...rest}
    >
      <div
        className={styles.bar}
        style={indeterminate ? undefined : { width: `${percentage}%` }}
      />
    </div>
  );
}
