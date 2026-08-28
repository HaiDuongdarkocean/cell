import { useRef, type ReactNode, type KeyboardEvent } from 'react';
import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';
import styles from './Drawer.module.css';

export interface DrawerProps {
  /** Whether the drawer is open. */
  open: boolean;
  /** Called when the drawer should close. */
  onOpenChange?: (open: boolean) => void;
  /** Drawer title. */
  title?: string;
  /** Main content. */
  children?: ReactNode;
  /** Footer actions. */
  footer?: ReactNode;
  /** Which side the drawer slides in from. Default: right. */
  side?: 'left' | 'right';
  /** Optional class name for the panel. */
  className?: string;
}

/**
 * Drawer — slide-in panel with overlay, focus trap (Tab/Shift+Tab cycle
 * within panel) + restore focus to trigger on close, and Esc to close.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  footer,
  side = 'right',
  className,
}: DrawerProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      onOpenChange?.(false);
    }
  };

  const handleOverlayClick = (): void => {
    onOpenChange?.(false);
  };

  const handlePanelClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="presentation" onKeyDown={handleKeyDown}>
      <div
        ref={panelRef}
        className={[styles.panel, styles[side], className ?? ''].filter(Boolean).join(' ')}
        onClick={handlePanelClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        {title && (
          <div className={styles.header}>
            <h2 id="drawer-title" className={styles.title}>{title}</h2>
            <Button material="solid" variant="ghost" size="sm" onClick={() => onOpenChange?.(false)} aria-label="Close">
              ×
            </Button>
          </div>
        )}
        {children && <div className={styles.content}>{children}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
