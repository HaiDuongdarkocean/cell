import { type ReactNode } from 'react';
import type { ICON_CATALOG } from '@/shared/icons';
import { NavItem } from './NavItem';
import styles from './CollapsibleSidebar.module.css';

export interface CollapsibleSidebarItem {
  id: string;
  icon: keyof typeof ICON_CATALOG;
  label: string;
  active?: boolean;
  onClick?: () => void;
  'data-cell-id'?: string;
}

export interface CollapsibleSidebarSection {
  id?: string;
  items: CollapsibleSidebarItem[];
}

export interface CollapsibleSidebarProps {
  /** Whether the sidebar is in collapsed (icon-only) mode. */
  collapsed?: boolean;
  /** Called when the user toggles collapse. If omitted, the built-in toggle is hidden. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Optional header node, e.g. a profile switcher. Rendered at the top. */
  header?: ReactNode;
  /** Grouped list of sidebar items. */
  sections: CollapsibleSidebarSection[];
  /** Optional footer node rendered at the bottom, below the collapse toggle. */
  footer?: ReactNode;
  /** HTML landmark tag. Defaults to 'aside'. */
  as?: 'aside' | 'nav';
  /** Accessible name for the sidebar. */
  'aria-label'?: string;
  /** Optional class name. */
  className?: string;
  /** Test hook / stable identifier. */
  'data-cell-id'?: string;
}

/**
 * CollapsibleSidebar — generic vertical rail that can be expanded (icon + label)
 * or collapsed (icon only). Designed for reuse across features.
 */
export function CollapsibleSidebar({
  as: Tag = 'aside',
  collapsed = false,
  onCollapsedChange,
  header,
  sections,
  footer,
  'aria-label': ariaLabel = 'Sidebar navigation',
  'data-cell-id': dataCellId,
  className,
}: CollapsibleSidebarProps): React.JSX.Element {
  return (
    <Tag
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${className ?? ''}`.trim()}
      aria-label={ariaLabel}
      data-cell-id={dataCellId}
    >
      {header && <div className={styles.header}>{header}</div>}

      <div className={styles.sections}>
        {sections.map((section) => {
          const sectionKey = section.id ?? section.items.map((i) => i.id).join('-');
          return (
            <ul
              key={sectionKey}
              className={styles.section}
              aria-label={section.id ? `Sidebar ${section.id}` : undefined}
            >
              {section.items.map((item) => (
                <li key={item.id}>
                  <NavItem
                    icon={item.icon}
                    label={item.label}
                    orientation="vertical"
                    active={item.active}
                    aria-current={item.active ? 'true' : undefined}
                    onClick={item.onClick}
                    data-cell-id={item['data-cell-id']}
                  />
                </li>
              ))}
            </ul>
          );
        })}
      </div>

      {onCollapsedChange && (
        <div className={styles.collapseSection} role="group" aria-label="Sidebar controls">
          <NavItem
            icon={collapsed ? 'chevronRight' : 'chevronLeft'}
            label={collapsed ? undefined : 'Collapse'}
            orientation="vertical"
            aria-label={collapsed ? 'Expand sidebar' : undefined}
            onClick={() => onCollapsedChange(!collapsed)}
            data-cell-id="collapsible-sidebar-toggle"
          />
        </div>
      )}

      {footer && <div className={styles.footer}>{footer}</div>}
    </Tag>
  );
}
