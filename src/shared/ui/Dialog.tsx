import { useRef, type ReactNode, type KeyboardEvent } from 'react';
import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';
import styles from './Dialog.module.css';

interface DialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the dialog should close (overlay click, Esc, close button). */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title. */
  title?: string;
  /** Dialog description. */
  description?: string;
  /** Main content. */
  children?: ReactNode;
  /** Footer actions (buttons). */
  footer?: ReactNode;
  /** Show a default close button in the header. */
  showCloseButton?: boolean;
  /** Center the title in the header (close button stays right via absolute
   *  positioning). Default: left-aligned with space-between. */
  centerTitle?: boolean;
  /** Test id for the overlay. */
  'data-testid'?: string;
}

/**
 * Dialog — accessible modal with overlay, focus trap (Tab/Shift+Tab cycle
 * within panel) + restore focus to trigger on close, Esc to close, and
 * click outside to close.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showCloseButton,
  centerTitle,
  'data-testid': dataTestId,
}: DialogProps): React.JSX.Element | null {
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
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="presentation"
      data-testid={dataTestId}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        onClick={handlePanelClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-description' : undefined}
      >
        {(title || showCloseButton) && (
          <div className={centerTitle ? `${styles.header} ${styles.headerCenterTitle}` : styles.header}>
            {showCloseButton && centerTitle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange?.(false)}
                aria-label="Close"
                className={styles.closeButtonAbsolute}
              >
                ×
              </Button>
            )}
            <div className={styles.headerText}>
              {title && <h2 id="dialog-title" className={styles.title}>{title}</h2>}
              {description && <p id="dialog-description" className={styles.description}>{description}</p>}
            </div>
            {showCloseButton && !centerTitle && (
              <Button variant="ghost" size="sm" onClick={() => onOpenChange?.(false)} aria-label="Close">
                ×
              </Button>
            )}
          </div>
        )}
        {children && <div className={styles.content}>{children}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
