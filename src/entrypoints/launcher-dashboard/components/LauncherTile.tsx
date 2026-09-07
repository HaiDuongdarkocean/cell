import { Icon } from '@/shared/ui';
import { Button } from '@/shared/ui/Button';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './LauncherTile.module.css';

export interface LauncherTileProps {
  icon: keyof typeof ICON_CATALOG;
  label: string;
  onClick?: () => void;
}

export function LauncherTile({ icon, label, onClick }: LauncherTileProps) {
  return (
    <Button variant="secondary" className={styles.tile} onClick={onClick} disabled={!onClick}>
      <span className={styles.icon}>
        <Icon name={icon} size="lg" />
      </span>
      <span className={styles.label}>{label}</span>
    </Button>
  );
}
