// SidebarItem — atom cho OptionsApp sidebar nav (UI-UX-Contract section 6, 11).
// Active: 2px primary left border + text color.
// Inactive: text-secondary color, no border.
// Icon: ICON_CATALOG key (renders SVG via <Icon>) or fallback string glyph.

import { type ReactElement } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { ICON_CATALOG } from '@/shared/icons';
import type { Tab } from './types';
import styles from './SidebarItem.module.css';

interface SidebarItemProps {
  readonly id: Tab;
  readonly label: string;
  readonly icon: string;
  readonly active: boolean;
  readonly onClick: (tab: Tab) => void;
}

export function SidebarItem({ id, label, icon, active, onClick }: SidebarItemProps): ReactElement {
  const isCatalogIcon = icon in ICON_CATALOG;
  return (
    <button
      type="button"
      className={`${styles.item} ${active ? styles.itemActive : ''}`}
      onClick={() => onClick(id)}
      aria-selected={active}
      role="tab"
      id={`nav-${id}`}
      aria-controls={`panel-${id}`}
      data-testid={`sidebar-item-${id}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {isCatalogIcon ? <Icon name={icon as keyof typeof ICON_CATALOG} size={20} /> : icon}
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
