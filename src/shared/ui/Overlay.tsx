import { useEffect, type HTMLAttributes, type ReactNode } from 'react';
import { pushEscapeLayer } from './escapeLayerStack';
import styles from './Overlay.module.css';

type OverlayElevation = 'low' | 'med' | 'high';

interface OverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClose'> {
  /** Whether the overlay is visible. Default: true. */
  visible?: boolean;
  /** Visual elevation / stacking order. Default: med. */
  elevation?: OverlayElevation;
  /** Apply a backdrop blur. Default: false. */
  blur?: boolean;
  /** Click handler for the backdrop. */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Called when the Escape key is pressed while the overlay is visible. */
  onClose?: () => void;
  /** Content rendered above the backdrop. */
  children?: ReactNode;
}

/**
 * Overlay — fixed full-viewport backdrop for modals, drawers, and popovers.
 * Clicks on the backdrop call `onClick`. Pressing Escape calls `onClose`.
 * Children are centered above the backdrop via flex.
 *
 * Elevation maps to z-index: low=10, med=100, high=1000.
 */
export function Overlay({
  visible = true,
  elevation = 'med',
  blur = false,
  onClick,
  onClose,
  children,
  className,
  ...rest
}: OverlayProps): React.JSX.Element | null {
  // Escape goes through the shared layer stack so the topmost overlay wins
  // and the key never bubbles up to ancestor surfaces (e.g. UniversalPanel).
  useEffect(() => {
    if (!visible || !onClose) return;
    const handler = onClose;
    return pushEscapeLayer(() => handler());
  }, [visible, onClose]);

  const cls = [
    styles.overlay,
    styles[elevation],
    blur ? styles.blur : '',
    visible ? styles.visible : styles.hidden,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      onClick={onClick}
      role="presentation"
      {...rest}
    >
      {children}
    </div>
  );
}
