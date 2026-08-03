import type { ButtonHTMLAttributes } from 'react';
import styles from './StatusBadge.module.css';

export type WordStatus = 'unknown' | 'tracking' | 'known' | 'ignore';

export interface StatusBadgeProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Word knowledge status. Default: unknown. */
  status?: WordStatus;
}

/**
 * StatusBadge — clickable pill that shows word knowledge status.
 * Tint background + solid foreground (variant A). Click cycles status
 * (caller handles cycling logic via onClick).
 */
export function StatusBadge({
  status = 'unknown',
  className,
  children,
  ...rest
}: StatusBadgeProps): React.JSX.Element {
  const cls = [styles.badge, styles[status], className ?? ''].filter(Boolean).join(' ');

  return (
    <button type="button" className={cls} {...rest}>
      {children ?? status}
    </button>
  );
}
