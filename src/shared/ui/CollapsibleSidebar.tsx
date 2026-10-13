import { Fragment, type ReactNode } from 'react';
import type { ICON_CATALOG } from '@/shared/icons';
import { t } from '@/shared/i18n';
import { NavItem } from './NavItem';
import { Separator } from './Separator';
import styles from './CollapsibleSidebar.module.css';

export interface CollapsibleSidebarItem {
  id: string;
  icon: keyof typeof ICON_CATALOG;
  label: string;
  active?: boolean;
  onClick?: () => void;
  'data-tihoka-id'?: string;
}

export interface CollapsibleSidebarSection {
  id?: string;
  /** Accessible label for the section group. */
  label?: string;
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
  'data-tihoka-id'?: string;
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
  'aria-label': ariaLabel = t('ui.sidebar.aria'),
  'data-tihoka-id': dataTihokaId,
  className,
}: CollapsibleSidebarProps): React.JSX.Element {
  return (
    <Tag
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${className ?? ''}`.trim()}
      aria-label={ariaLabel}
      data-tihoka-id={dataTihokaId}
    >
      {header && <div className={styles.header}>{header}</div>}

      <div className={styles.sections}>
        {sections.map((section, sectionIndex) => {
          const sectionKey = section.id ?? section.items.map((i) => i.id).join('-');
          return (
            <Fragment key={sectionKey}>
              {sectionIndex > 0 && <Separator className={styles.sectionSeparator} />}
              <ul
                className={styles.section}
                aria-label={section.label}
              >
                {section.items.map((item) => (
                  <li key={item.id}>
                    <NavItem
                      icon={item.icon}
                      label={item.label}
                      orientation="vertical"
                      active={item.active}
                      aria-current={item.active ? 'page' : undefined}
                      onClick={item.onClick}
                      data-tihoka-id={item['data-tihoka-id']}
                    />
                  </li>
                ))}
              </ul>
            </Fragment>
          );
        })}
      </div>

      {onCollapsedChange && (
        <div className={styles.collapseSection} role="group" aria-label={t('ui.sidebar.controlsAria')}>
          <NavItem
            icon={collapsed ? 'chevronRight' : 'chevronLeft'}
            label={collapsed ? undefined : t('ui.collapse.collapse')}
            orientation="vertical"
            aria-label={collapsed ? t('ui.sidebar.expandAria') : undefined}
            onClick={() => onCollapsedChange(!collapsed)}
            data-tihoka-id="collapsible-sidebar-toggle"
          />
        </div>
      )}

      {footer && <div className={styles.footer}>{footer}</div>}
    </Tag>
  );
}
