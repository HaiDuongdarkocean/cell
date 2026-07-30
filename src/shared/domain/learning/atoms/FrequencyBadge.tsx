import type { HTMLAttributes } from 'react';
import styles from './FrequencyBadge.module.css';

export type FrequencyLevel = 'common' | 'frequent' | 'rare' | 'academic' | 'archaic';

export interface FrequencyBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Frequency level of the word. Default: common. */
  level?: FrequencyLevel;
}

/**
 * FrequencyBadge — display-only pill that indicates how common a word is.
 * Tint color reflects the frequency level using token-freq color tokens.
 */
export function FrequencyBadge({
  level = 'common',
  className,
  children,
  ...rest
}: FrequencyBadgeProps): React.JSX.Element {
  const cls = [styles.badge, styles[level], className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={cls} aria-label={`Frequency: ${level}`} {...rest}>
      {children ?? level}
    </span>
  );
}
