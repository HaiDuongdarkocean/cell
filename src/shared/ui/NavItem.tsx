import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './NavItem.module.css';

type NavItemOrientation = 'horizontal' | 'vertical';

export interface NavItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon element, or icon name from ICON_CATALOG. */
  icon?: ReactNode | string;
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
 * NavItem — self-contained navigation item.
 *
 * Does not depend on Button; owns its own styling.
 * When `icon` is an icon name, it renders the UI Icon in currentColor so
 * the parent can control active/inactive color via CSS.
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

  const iconNode =
    typeof icon === 'string' ? (
      <Icon name={icon as keyof typeof ICON_CATALOG} size="sm" color="current" />
    ) : (
      icon
    );

  return (
    <button type="button" className={cls} disabled={disabled} {...rest}>
      <span className={styles.pill} aria-hidden="true" />
      {iconNode && <span className={styles.icon}>{iconNode}</span>}
      {label && <span className={styles.label}>{label}</span>}
    </button>
  );
}
