import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual variant. Default: default. */
  variant?: BadgeVariant;
  /** Size. Default: md. */
  size?: BadgeSize;
  children: ReactNode;
}

/**
 * Badge — small status label with variants and sizes.
 */
export function Badge({ variant = 'default', size = 'md', children, className, ...rest }: BadgeProps): React.JSX.Element {
  const cls = [styles.badge, styles[variant], styles[size], className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
