import type { ButtonHTMLAttributes } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './CollapseButton.module.css';

type CollapseButtonSize = 'sm' | 'md' | 'lg';
type CollapseDirection = 'horizontal' | 'vertical';

const ICON_SIZE: Record<CollapseButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface CollapseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Controlled collapsed state. When true, chevron rotates 180deg. */
  collapsed: boolean;
  /** ID of the region this button controls (aria-controls). */
  controlsId?: string;
  /** Override the default aria-label. */
  ariaLabel?: string;
  /** Chevron rotation axis: vertical=up/down (default), horizontal=left/right. */
  direction?: CollapseDirection;
  /** Show "Collapse"/"Expand" text label next to the icon. Default: false. */
  showLabel?: boolean;
  /** Button box size: sm=28px, md=32px, lg=36px. Default 'md'. */
  size?: CollapseButtonSize;
}

/**
 * CollapseButton — controlled toggle atom for expand/collapse actions.
 *
 * Uses the `chevronDown` icon; rotates 180deg when `collapsed` is true.
 * `aria-expanded` reflects the expanded state (inverse of `collapsed`).
 * `aria-controls` links to the collapsible region id.
 */
export function CollapseButton({
  collapsed,
  controlsId,
  ariaLabel,
  direction = 'vertical',
  showLabel = false,
  size = 'md',
  className,
  ...rest
}: CollapseButtonProps): React.JSX.Element {
  const cls = [
    styles.collapseBtn,
    styles[size],
    styles[direction],
    collapsed ? styles.collapsed : '',
    showLabel ? styles.withLabel : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Button variant="secondary"
      className={cls}
      aria-expanded={!collapsed}
      aria-controls={controlsId}
      aria-label={ariaLabel}
      {...rest}
    >
      <Icon name="chevronDown" size={ICON_SIZE[size]} />
      {showLabel && (
        <span className={styles.label}>{collapsed ? 'Expand' : 'Collapse'}</span>
      )}
    </Button>
  );
}
