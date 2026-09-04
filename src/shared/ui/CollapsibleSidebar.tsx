import { useId, type ReactNode } from 'react';
import type { ICON_CATALOG } from '@/shared/icons';
import { Icon } from '@/shared/icons/Icon';
import { Button } from './Button';
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
  collapsed = false,
  onCollapsedChange,
  header,
  sections,
  footer,
  'aria-label': ariaLabel = 'Sidebar navigation',
  'data-cell-id': dataCellId,
  className,
}: CollapsibleSidebarProps): React.JSX.Element {
  const headerId = useId();

  return (
    <nav
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${className ?? ''}`.trim()}
      aria-label={ariaLabel}
      data-cell-id={dataCellId}
    >
      {header && <div className={styles.header}>{header}</div>}

      <div className={styles.sections} role="tablist" aria-labelledby={header ? headerId : undefined}>
        {sections.map((section) => (
          <div key={section.id ?? section.items.map((i) => i.id).join('-')} className={styles.section}>
            {section.items.map((item) => (
              <Button
                key={item.id}
                material="solid"
                variant="ghost"
                shape="pill"
                size="md"
                fullWidth
                active={item.active}
                aria-label={item.label}
                aria-selected={item.active}
                role="tab"
                tabIndex={item.active ? 0 : -1}
                onClick={item.onClick}
                data-cell-id={item['data-cell-id']}
                className={styles.item}
              >
                <Icon name={item.icon} size={20} />
                <span className={styles.label}>{item.label}</span>
              </Button>
            ))}
          </div>
        ))}
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
          className={styles.item}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={20} />
          <span className={styles.label}>{collapsed ? 'Expand' : 'Collapse'}</span>
        </Button>
      )}

      {footer && <div className={styles.footer}>{footer}</div>}
    </nav>
  );
}
