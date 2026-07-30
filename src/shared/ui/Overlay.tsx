import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Overlay.module.css';

interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether the overlay is visible. Default: true. */
  open?: boolean;
  /** Click handler for the backdrop. */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Content rendered above the backdrop. */
  children?: ReactNode;
}

/**
 * Overlay — fixed full-viewport backdrop for modals, drawers, and popovers.
 * Clicks on the backdrop call `onClick`. Children are centered above the
 * backdrop via flex.
 */
export function Overlay({
  open = true,
  onClick,
  children,
  className,
  ...rest
}: OverlayProps): React.JSX.Element | null {
  if (!open) return null;

  const cls = [styles.overlay, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={onClick} role="presentation" {...rest}>
      {children}
    </div>
  );
}
