import { useRef, type ReactNode, type KeyboardEvent } from 'react';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';
import styles from './BottomSheet.module.css';

export interface BottomSheetProps {
  /** Whether the bottom sheet is open. */
  open: boolean;
  /** Called when the sheet should close. */
  onOpenChange?: (open: boolean) => void;
  /** Sheet title. */
  title?: string;
  /** Main content. */
  children?: ReactNode;
  /** Footer actions. */
  footer?: ReactNode;
  /** Test id for the overlay. */
  'data-testid'?: string;
}

/**
 * BottomSheet — slide-up panel anchored to the bottom of the viewport for
 * mobile (Card Creator on Kiwi/Edge Android). Mirrors the Dialog API but
 * with bottom-anchored layout, drag handle, and 75vh max height.
 *
 * Accessibility: role="dialog" + aria-modal, Esc to close, click outside to
 * close, focus trap (Tab/Shift+Tab cycle within panel) + restore focus to
 * trigger on close (useFocusTrap hook).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  'data-testid': dataTestId,
}: BottomSheetProps): React.JSX.Element | null {
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
        className={styles.sheet}
        onClick={handlePanelClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        <div className={styles.dragHandle} aria-hidden="true" />
        {(title || onOpenChange) && (
          <div className={styles.header}>
            {title && (
              <h2 id="bottom-sheet-title" className={styles.title}>{title}</h2>
            )}
            <IconButton
              size="sm"
              aria-label="Close"
              onClick={() => onOpenChange?.(false)}
            >
              {/* FIXME: extract to registry once stroke-width variant supported — strokeWidth 1.5 differs from ICON_CATALOG.x (stroke 2) */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
        )}
        {children && <div className={styles.content}>{children}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
