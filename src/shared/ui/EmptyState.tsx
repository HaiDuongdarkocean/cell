import type { HTMLAttributes, ReactNode } from 'react';
import styles from './EmptyState.module.css';

export type EmptyStateSize = 'md' | 'compact' | 'sm';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Icon or illustration. */
  icon?: ReactNode;
  /** Title. */
  title?: ReactNode;
  /** Description text. */
  description?: ReactNode;
  /** Optional action button or link. */
  action?: ReactNode;
  /** Size variant. `md` = default 48px icon; `compact` = 36px icon for panels; `sm` = 24px icon for compact panels. */
  size?: EmptyStateSize;
}

/**
 * EmptyState — placeholder for empty lists or panels (Astryx pattern).
 *
 * Centered flex column: icon → title → description → optional action.
 * `role="status"` announces the empty state to screen readers.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
  ...rest
}: EmptyStateProps): React.JSX.Element {
  const cls = [styles.root, styles[size], className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} role="status" {...rest}>
      {icon && <div className={`${styles.icon} ${styles[`icon${capitalize(size)}`]}`}>{icon}</div>}
      {title && <div className={`${styles.title} ${styles[`title${capitalize(size)}`]}`}>{title}</div>}
      {description && <div className={`${styles.description} ${styles[`description${capitalize(size)}`]}`}>{description}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

function capitalize(size: EmptyStateSize): string {
  return size[0].toUpperCase() + size.slice(1);
}
