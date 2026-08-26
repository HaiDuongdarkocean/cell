import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import styles from './Card.module.css';

type CardVariant = 'default' | 'interactive' | 'selected' | 'glass';

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
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', children, className, ...rest },
  ref: Ref<HTMLDivElement>,
): React.JSX.Element {
  const cls = [styles.card, styles[variant], className ?? ''].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={cls} {...rest}>
      {children}
    </div>
  );
});
