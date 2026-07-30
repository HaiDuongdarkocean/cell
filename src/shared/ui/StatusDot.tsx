import type { HTMLAttributes } from 'react';
import styles from './StatusDot.module.css';

type StatusDotStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusDotProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'aria-label'> {
  /** Status color. Default: neutral. */
  status?: StatusDotStatus;
  /** Show a pulse animation to indicate an active/live state. Default: false. */
  pulse?: boolean;
  /**
   * Accessible label — REQUIRED. The dot has no visible text, so this label
   * is the only way screen readers can announce the status.
   */
  'aria-label': string;
}

/**
 * StatusDot — small colored dot indicating a status.
 * No visible text; `aria-label` is required for screen reader accessibility.
 * Use `pulse` for live/active indicators.
 */
export function StatusDot({
  status = 'neutral',
  pulse = false,
  className,
  'aria-label': ariaLabel,
  ...rest
}: StatusDotProps): React.JSX.Element {
  const cls = [
    styles.dot,
    styles[status],
    pulse ? styles.pulse : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={cls}
      role="img"
      aria-label={ariaLabel}
      {...rest}
    />
  );
}
