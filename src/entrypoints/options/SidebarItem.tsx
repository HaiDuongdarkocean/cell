// SidebarItem — options page sidebar nav item (BEM + design-system tokens).

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

function isIconName(name: string): name is keyof typeof ICON_CATALOG {
  return name in ICON_CATALOG;
}

export function SidebarItem({ id, label, icon, active, onClick }: SidebarItemProps): ReactElement {
  const rootClass = [styles['sidebar-item'], active ? styles['sidebar-item--active'] : ''].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={rootClass}
      onClick={() => onClick(id)}
      aria-selected={active}
      role="tab"
      id={`nav-${id}`}
      aria-controls={`panel-${id}`}
      tabIndex={active ? 0 : -1}
      data-testid={`sidebar-item-${id}`}
    >
      <span className={styles['sidebar-item__icon']} aria-hidden="true">
        {isIconName(icon) ? <Icon name={icon} size={20} /> : icon}
      </span>
      <span className={styles['sidebar-item__label']}>{label}</span>
    </button>
  );
}
