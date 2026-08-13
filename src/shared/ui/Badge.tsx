import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'muted';
type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual variant. Default: default. */
  variant?: BadgeVariant;
  /** Size. Default: md. */
  size?: BadgeSize;
  /** When set and children is a number, displays "max+" when value exceeds max (e.g. 99+). */
  max?: number;
  children: ReactNode;
}

/**
 * Badge — small status label with variants and sizes.
 */
export function Badge({ variant = 'default', size = 'md', max, children, className, ...rest }: BadgeProps): React.JSX.Element {
  const cls = [styles.badge, styles[variant], styles[size], className ?? ''].filter(Boolean).join(' ');

  const display = (() => {
    if (max !== undefined && typeof children === 'number' && children > max) {
      return `${max}+`;
    }
    return children;
  })();

  return (
    <span className={cls} {...rest}>
      {display}
    </span>
  );
}
