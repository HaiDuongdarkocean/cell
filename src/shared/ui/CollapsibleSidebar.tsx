import { type ReactNode } from 'react';
import type { ICON_CATALOG } from '@/shared/icons';
import { Icon } from '@/shared/icons/Icon';
import { Button } from './Button';
import { Navigation } from './Navigation';
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
          const activeItem = section.items.find((i) => i.active);
          const sectionKey = section.id ?? section.items.map((i) => i.id).join('-');
          if (activeItem) {
            return (
              <Navigation
                key={sectionKey}
                className={styles.nav}
                orientation="vertical"
                activeId={activeItem.id}
                onActiveChange={(id) => {
                  const item = section.items.find((i) => i.id === id);
                  item?.onClick?.();
                }}
                ariaLabel={section.id ? `Sidebar ${section.id}` : 'Sidebar navigation'}
              >
                {section.items.map((item) => (
                  <NavItem
                    key={item.id}
                    data-section-id={item.id}
                    icon={<Icon name={item.icon} size={20} />}
                    label={item.label}
                    orientation="vertical"
                    data-cell-id={item['data-cell-id']}
                  />
                ))}
              </Navigation>
            );
          }
          return (
            <div key={sectionKey} className={styles.section} role="group">
              {section.items.map((item) => (
                <NavItem
                  key={item.id}
                  icon={<Icon name={item.icon} size={20} />}
                  label={item.label}
                  orientation="vertical"
                  onClick={item.onClick}
                  data-cell-id={item['data-cell-id']}
                />
              ))}
            </div>
          );
        })}
      </div>

      {onCollapsedChange && (
        <Button
          material="solid"
          variant="ghost"
          shape="pill"
          size="md"
          fullWidth
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => onCollapsedChange(!collapsed)}
          data-cell-id="collapsible-sidebar-toggle"
          className={styles.collapseButton}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={20} />
          <span className={styles.collapseLabel}>{collapsed ? 'Expand' : 'Collapse'}</span>
        </Button>
      )}

      {footer && <div className={styles.footer}>{footer}</div>}
    </Tag>
  );
}
