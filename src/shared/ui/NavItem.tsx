import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import styles from './NavItem.module.css';

type NavItemOrientation = 'horizontal' | 'vertical';

export interface NavItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon element. */
  icon?: ReactNode;
  /** Label text or element. */
  label?: ReactNode;
  /** Active state. */
  active?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Layout orientation. Default: vertical. */
  orientation?: NavItemOrientation;
}

/**
 * NavItem — navigation item for sidebar or horizontal nav.
 */
export function NavItem({
  icon,
  label,
  active,
  disabled,
  orientation = 'vertical',
  className,
  ...rest
}: NavItemProps): React.JSX.Element {
  const cls = [styles.item, styles[orientation], active ? styles.active : '', disabled ? styles.disabled : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <Button material="solid" variant="secondary" shape="pill" className={cls} disabled={disabled} {...rest}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {label && <span className={styles.label}>{label}</span>}
    </Button>
  );
}
