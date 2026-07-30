import type { HTMLAttributes, ReactNode } from 'react';
import styles from './SourceBadge.module.css';

export type DictionarySource =
  | 'cambridge'
  | 'oxford'
  | 'merriam-webster'
  | 'collins'
  | 'longman';

export interface SourceBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** The dictionary source. */
  source: DictionarySource;
  children: ReactNode;
  /** Badge size. sm uses --font-size-2xs, md uses --font-size-xs. */
  size?: 'sm' | 'md';
}

/**
 * SourceBadge — small label indicating the dictionary source of an entry.
 * Uses `--color-background-muted` with pill radius.
 */
export function SourceBadge({ source, children, className, size = 'md', ...rest }: SourceBadgeProps): React.JSX.Element {
  const cls = [styles.badge, styles[size], className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={`Source: ${source}`} {...rest}>
      {children}
    </span>
  );
}
