// SidebarItem — atom cho OptionsApp sidebar nav (UI-UX-Contract section 6, 11).
// Active: 2px terminal-green left border + --color-snow text.
// Inactive: --color-pearl text, no border.

import { type ReactElement } from 'react';
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
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
