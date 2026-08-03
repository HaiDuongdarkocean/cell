import type { HTMLAttributes } from 'react';
import styles from './FrequencyBadge.module.css';

export type FrequencyLevel = 'core' | 'common' | 'general' | 'advanced' | 'rare';

export interface FrequencyBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Frequency level of the word. Default: common. */
  level?: FrequencyLevel;
  /** Source dictionary label (e.g. "COCA"). Optional. */
  source?: string;
  /** Rank number (e.g. 1234). Optional. */
  rank?: number;
}

/**
 * FrequencyBadge — display-only pill that indicates how common a word is.
 * Two-part: source (solid freq-fg) + rank (tint freq-bg). Uses token-freq
 * color tokens (absolute hex, same for light & dark).
 */
export function FrequencyBadge({
  level = 'common',
  source,
  rank,
  className,
  children,
  ...rest
}: FrequencyBadgeProps): React.JSX.Element {
  const cls = [styles.badge, styles[level], className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={cls} aria-label={`Frequency: ${level}`} {...rest}>
      {source && <span className={styles.source}>{source}</span>}
      {rank !== undefined && <span className={styles.rank}>{rank.toLocaleString()}</span>}
      {children}
    </span>
  );
}
