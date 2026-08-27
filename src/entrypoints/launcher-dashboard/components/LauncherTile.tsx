import { Icon } from '@/shared/ui';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './LauncherTile.module.css';

export interface LauncherTileProps {
  icon: keyof typeof ICON_CATALOG;
  label: string;
  onClick?: () => void;
}

export function LauncherTile({ icon, label, onClick }: LauncherTileProps) {
  return (
    <button type="button" className={styles.tile} onClick={onClick}>
      <span className={styles.icon}>
        <Icon name={icon} size="lg" />
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
