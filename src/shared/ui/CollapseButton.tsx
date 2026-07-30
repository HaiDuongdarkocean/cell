import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './CollapseButton.module.css';

interface CollapseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Controlled collapsed state. When true, chevron rotates 180deg. */
  collapsed: boolean;
  /** ID of the region this button controls (aria-controls). */
  controlsId?: string;
  /** Override the default aria-label. */
  ariaLabel?: string;
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
  className,
  ...rest
}: CollapseButtonProps): React.JSX.Element {
  const cls = [styles.collapseBtn, collapsed ? styles.collapsed : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-expanded={!collapsed}
      aria-controls={controlsId}
      aria-label={ariaLabel}
      {...rest}
    >
      <Icon name="chevronDown" size={20} />
    </button>
  );
}
