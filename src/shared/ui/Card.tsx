import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

type CardVariant = 'default' | 'interactive' | 'selected';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant. Default: default. */
  variant?: CardVariant;
  /** Card content. */
  children: ReactNode;
}

/**
 * Card — container for grouped content with consistent surface, border, and
 * radius. Use `variant="interactive"` for clickable cards, `variant="selected"`
 * for active/selected state.
 */
export function Card({ variant = 'default', children, className, ...rest }: CardProps): React.JSX.Element {
  const cls = [styles.card, styles[variant], className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
