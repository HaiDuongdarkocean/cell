import type { ReactNode } from 'react';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  /** Item label. */
  label: ReactNode;
  /** Optional id or href. */
  id?: string;
  /** Whether this item is the current/active segment. */
  current?: boolean;
}

export interface BreadcrumbProps {
  /** Path segments, left-to-right. */
  items: BreadcrumbItem[];
  /** Optional accessible label. */
  ariaLabel?: string;
  /** Optional class name. */
  className?: string;
}

/**
 * Breadcrumb — path navigation with slash separators.
 *
 * Last item is automatically marked as current if no item has `current=true`.
 */
export function Breadcrumb({ items, ariaLabel = 'Breadcrumb', className }: BreadcrumbProps): React.JSX.Element | null {
  if (items.length === 0) return null;

  const lastIndex = items.findIndex((i) => i.current) !== -1
    ? items.findIndex((i) => i.current)
    : items.length - 1;

  return (
    <nav className={[styles.breadcrumb, className ?? ''].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <ol className={styles.list}>
        {items.map((item, index) => (
          <li
            key={item.id ?? `crumb-${index}`}
            className={[styles.item, index === lastIndex ? styles.current : ''].filter(Boolean).join(' ')}
            aria-current={index === lastIndex ? 'page' : undefined}
          >
            {item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
