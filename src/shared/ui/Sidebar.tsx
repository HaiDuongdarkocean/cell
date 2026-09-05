import { useState, useId, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  /** Slot header content (e.g. title, search, actions). */
  header?: ReactNode;
  /** Whether a collapse toggle button is shown. */
  collapsible?: boolean;
  /** Controlled collapsed state. */
  collapsed?: boolean;
  /** Called when collapsed state changes. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Accessible label for the aside landmark. */
  ariaLabel?: string;
  /** Optional class name. */
  className?: string;
  /** Sidebar body content — can be Navigation, Form, Filter, etc. */
  children: ReactNode;
}

/**
 * Sidebar — responsive layout shell container (`container > header + body`).
 *
 * - Co giãn linh hoạt theo kích thước phần tử bên trong (`fit-content`).
 * - Quản lý trạng thái thu gọn/mở rộng `collapsible` + `collapsed`.
 * - Tách biệt hoàn toàn khỏi logic Navigation (không còn phụ thuộc vào sectionRefs, activeId hay rAF).
 */
export function Sidebar({
  header,
  collapsible,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  ariaLabel,
  className,
  children,
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
      id={id}
      className={[styles.sidebar, collapsed ? styles.collapsed : '', className ?? ''].filter(Boolean).join(' ')}
      aria-expanded={!collapsed}
      aria-label={ariaLabel}
      data-collapsed={collapsed ? '' : undefined}
    >
      {(header || collapsible) && (
        <div className={styles.topbar}>
          {header && <div className={styles.headerContent}>{header}</div>}
          {collapsible && (
            <Button shape="circle"
              material="solid"
              type="button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-controls={id}
              aria-expanded={!collapsed}
              variant="ghost"
              size="sm"
              onClick={toggle}
            >
              <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
            </Button>
          )}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
