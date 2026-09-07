import { useId, type ReactNode } from 'react';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  header?: ReactNode;
  collapsed?: boolean;
  orientation?: 'vertical' | 'horizontal';
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export function Sidebar({
  header,
  collapsed = false,
  orientation = 'vertical',
  ariaLabel,
  className,
  children,
}: SidebarProps): React.JSX.Element {
  const id = useId();

  return (
    <aside
      id={id}
      className={[styles.sidebar, collapsed ? styles.collapsed : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
      data-collapsed={collapsed ? '' : undefined}
      data-orientation={orientation}
    >
      {header && (
        <div className={styles.topbar}>
          <div className={styles.headerContent}>{header}</div>
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
