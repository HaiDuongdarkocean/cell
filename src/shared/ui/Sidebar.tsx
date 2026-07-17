import { useState, useId, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import { Icon } from '@/shared/icons/Icon';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  /** Sidebar content. */
  children: ReactNode;
  /** Whether a collapse toggle is shown. */
  collapsible?: boolean;
  /** Controlled collapsed state. */
  collapsed?: boolean;
  /** Called when collapsed state changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Optional header content. */
  header?: ReactNode;
  /** Optional class name. */
  className?: string;
}

/**
 * Sidebar — vertical navigation container with optional collapse.
 */
export function Sidebar({
  children,
  collapsible,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  header,
  className,
}: SidebarProps): React.JSX.Element {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const id = useId();

  const toggle = (): void => {
    const next = !collapsed;
    if (controlledCollapsed === undefined) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  return (
    <aside
      className={[styles.sidebar, collapsed ? styles.collapsed : '', className ?? ''].filter(Boolean).join(' ')}
      aria-expanded={!collapsed}
    >
      {header && <div className={styles.header}>{header}</div>}
      {collapsible && (
        <div className={styles.toolbar}>
          <IconButton
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-controls={id}
            variant="ghost"
            size="xs"
            onClick={toggle}
          >
            <Icon name="menu" />
          </IconButton>
        </div>
      )}
      <nav id={id} className={styles.nav}>
        {children}
      </nav>
    </aside>
  );
}
