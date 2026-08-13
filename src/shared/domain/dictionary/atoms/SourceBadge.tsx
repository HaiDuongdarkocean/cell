import type { HTMLAttributes, ReactNode } from 'react';
import { Badge } from '@/shared/ui/Badge';

export type DictionarySource =
  | 'cambridge'
  | 'oxford'
  | 'merriam-webster'
  | 'collins'
  | 'longman';

export interface SourceBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The dictionary source. */
  source: DictionarySource;
  children: ReactNode;
  /** Badge size. sm uses --font-size-2xs, md uses --font-size-xs. */
  size?: 'sm' | 'md';
}

/**
 * SourceBadge — small label indicating the dictionary source of an entry.
 * Uses the shared Badge atom with a muted pill style.
 */
export function SourceBadge({ source, children, size = 'md', ...rest }: SourceBadgeProps): React.JSX.Element {
  const badgeSize = size === 'sm' ? 'xs' : 'sm';

  return (
    <Badge variant="muted" size={badgeSize} aria-label={`Source: ${source}`} {...rest}>
      {children}
    </Badge>
  );
}
