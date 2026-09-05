import type { CSSProperties } from 'react';
import { Icon as IconBase } from '@/shared/icons/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './Icon.module.css';

type IconSize = 'xs' | 'sm' | 'md' | 'lg';
type IconColor = 'primary' | 'secondary' | 'disabled' | 'inverse' | 'current';

interface IconProps {
  /** Icon name from ICON_CATALOG. */
  name: keyof typeof ICON_CATALOG;
  /** Semantic size. Default: md. */
  size?: IconSize;
  /** Icon color. Default: current (inherits parent text color). */
  color?: IconColor;
  /** Accessible label — when provided, sets role="img" + aria-label. */
  label?: string;
  /** Extra class names. */
  className?: string;
  /** Inline style override. */
  style?: CSSProperties;
}

const SIZE_MAP: Record<IconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
};

/**
 * Icon — UI atom wrapping the ICON_CATALOG registry with semantic sizes and colors.
 *
 * Sizes: xs (16), sm (20), md (24), lg (32).
 * Colors: primary, secondary, disabled, inverse.
 * By default icons are decorative (aria-hidden). Pass `label` for meaningful icons.
 */
export function Icon({
  name,
  size = 'md',
  color = 'current',
  label,
  className,
  style,
}: IconProps): React.JSX.Element {
  const cls = [styles.icon, styles[color], className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={cls}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      style={style}
    >
      <IconBase name={name} size={SIZE_MAP[size]} />
    </span>
  );
}
