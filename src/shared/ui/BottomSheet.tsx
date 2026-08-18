import { useRef, type ReactNode, type KeyboardEvent } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Flex, HStack, VStack } from '.';
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
  /** Center the title in the header (close button stays right via absolute
   *  positioning). Default: left-aligned with space-between. */
  centerTitle?: boolean;
  /** Test id for the overlay. */
  'data-cell-id'?: string;
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
  centerTitle,
  'data-cell-id': dataTestId,
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
    <Flex
      align="end"
      justify="center"
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="presentation"
      data-cell-id={dataTestId}
    >
      <VStack
        ref={panelRef}
        gap="3"
        className={styles.sheet}
        onClick={handlePanelClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        <div className={styles.dragHandle} aria-hidden="true" />
        {(title || onOpenChange) && (
          <HStack
            align="center"
            justify={centerTitle ? 'center' : 'between'}
            gap="2"
            className={centerTitle ? `${styles.header} ${styles.headerCenterTitle}` : styles.header}
          >
            {title && (
              <h2 id="bottom-sheet-title" className={styles.title}>{title}</h2>
            )}
            <IconButton
              size="sm"
              aria-label="Close"
              onClick={() => onOpenChange?.(false)}
              className={centerTitle ? styles.closeButtonAbsolute : styles.closeIcon}
            >
              <Icon name="x"  />
            </IconButton>
          </HStack>
        )}
        {children && <VStack gap="3">{children}</VStack>}
        {footer && <HStack align="center" justify="between" gap="2" className={styles.footer}>{footer}</HStack>}
      </VStack>
    </Flex>
  );
}
