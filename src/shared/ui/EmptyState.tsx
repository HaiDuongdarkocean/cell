import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Icon or illustration (rendered at 48px). */
  icon?: ReactNode;
  /** Title (heading-3 scale). */
  title?: ReactNode;
  /** Description text (body scale, secondary color). */
  description?: ReactNode;
  /** Optional action button or link. */
  action?: ReactNode;
}

/**
 * EmptyState — placeholder for empty lists or panels (Astryx pattern).
 *
 * Centered flex column: large icon (48px, secondary color) → title
 * (heading-3) → description (body, secondary) → optional action.
 * `role="status"` announces the empty state to screen readers.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={styles.root} role="status">
      {icon && <div className={styles.icon}>{icon}</div>}
      {title && <div className={styles.title}>{title}</div>}
      {description && <div className={styles.description}>{description}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
