import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import { spawnRipple } from '@/shared/lib/dom/ripple';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './NavItem.module.css';

type NavItemOrientation = 'horizontal' | 'vertical';

export interface NavItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode | string;
  label?: ReactNode;
  /** Accessible/native tooltip for icon-only or collapsed states. */
  tooltip?: string;
  active?: boolean;
  disabled?: boolean;
  orientation?: NavItemOrientation;
}

export function NavItem({
  icon,
  label,
  tooltip,
  active,
  disabled,
  orientation = 'vertical',
  className,
  title,
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

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    rest.onPointerDown?.(e);
    if (disabled || e.defaultPrevented) return;
    spawnRipple(e.currentTarget, e.clientX, e.clientY);
  };

  return (
    <button type="button" className={cls} disabled={disabled} title={tooltip ?? title} data-cell-ripple-self {...rest} onPointerDown={handlePointerDown}>
      <span className={styles.pill} aria-hidden="true" />
      {iconNode && <span className={styles.icon}>{iconNode}</span>}
      {label && <span className={styles.label}>{label}</span>}
    </button>
  );
}
