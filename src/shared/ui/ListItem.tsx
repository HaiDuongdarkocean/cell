import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ListItem.module.css';

export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Leading content (icon, avatar). */
  leading?: ReactNode;
  /** Trailing content (icon, badge). */
  trailing?: ReactNode;
  /** Active state. */
  active?: boolean;
  /** Main content. */
  children: ReactNode;
}

/**
 * ListItem — row with leading/trailing content and active state.
 */
export function ListItem({ leading, trailing, active, children, className, ...rest }: ListItemProps): React.JSX.Element {
  const cls = [styles.item, active ? styles.active : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={cls} {...rest}>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.content}>{children}</span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
