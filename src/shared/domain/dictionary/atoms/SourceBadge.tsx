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
}

/**
 * SourceBadge — small label indicating the dictionary source of an entry.
 * Uses `--color-background-muted` with pill radius.
 */
export function SourceBadge({ source, children, className, ...rest }: SourceBadgeProps): React.JSX.Element {
  const cls = [styles.badge, className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={`Source: ${source}`} {...rest}>
      {children}
    </span>
  );
}
