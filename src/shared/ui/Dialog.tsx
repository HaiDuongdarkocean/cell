import { useRef, type ReactNode, type KeyboardEvent } from 'react';
import { HStack } from './Stack';
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
  /** Extra content rendered in the header, next to the close button (left of
   *  close). Used for the queue sidebar toggle icon. */
  headerExtra?: ReactNode;
  /** Center the title in the header (close button stays right via absolute
   *  positioning). Default: left-aligned with space-between. */
  centerTitle?: boolean;
  /** Test id for the overlay. */
  'data-cell-id'?: string;
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
  headerExtra,
  centerTitle,
  'data-cell-id': dataTestId,
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
      data-cell-id={dataTestId}
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
          <HStack
            align="start"
            justify={centerTitle ? 'center' : 'between'}
            gap="3"
            className={centerTitle ? `${styles.header} ${styles.headerCenterTitle}` : styles.header}
          >
            {showCloseButton && centerTitle && (
              <HStack align="center" gap="1" className={styles.headerRightGroup}>
                {headerExtra}
                <Button material="solid"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange?.(false)}
                  aria-label="Close"
                >
                  ×
                </Button>
              </HStack>
            )}
            <div className={styles.headerText}>
              {title && <h2 id="dialog-title" className={styles.title}>{title}</h2>}
              {description && <p id="dialog-description" className={styles.description}>{description}</p>}
            </div>
            {showCloseButton && !centerTitle && (
              <HStack align="center" gap="1" className={styles.headerRightGroup}>
                {headerExtra}
                <Button material="solid" variant="ghost" size="sm" onClick={() => onOpenChange?.(false)} aria-label="Close">
                  ×
                </Button>
              </HStack>
            )}
          </HStack>
        )}
        {children && <div className={styles.content}>{children}</div>}
        {footer && <HStack justify="end" gap="3" className={styles.footer}>{footer}</HStack>}
      </div>
    </div>
  );
}
