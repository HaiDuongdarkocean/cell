import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Icon or illustration. */
  icon?: ReactNode;
  /** Title. */
  title?: ReactNode;
  /** Description text. */
  description?: ReactNode;
  /** Optional action button or link. */
  action?: ReactNode;
}

/**
 * EmptyState — placeholder for empty lists or panels.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={styles.root}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {title && <div className={styles.title}>{title}</div>}
      {description && <div className={styles.description}>{description}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
