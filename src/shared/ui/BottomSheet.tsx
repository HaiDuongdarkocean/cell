import { useEffect, useRef, type ReactNode } from 'react';
import { Flex, HStack, VStack } from '.';
import { CloseButton } from './CloseButton';
import { Heading } from './Heading';
import { useFocusTrap } from './useFocusTrap';
import { pushEscapeLayer } from './escapeLayerStack';
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
  /** Hide the default header (title + close button). Use when the consumer
   *  provides its own header inside children. Default: false. */
  hideHeader?: boolean;
  /** Hide the drag handle. Default: false. */
  hideDragHandle?: boolean;
  /** Custom className for the sheet panel (extends styles.sheet). */
  className?: string;
  /** Test id for the overlay. */
  'data-tihoka-id'?: string;
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
  hideHeader,
  hideDragHandle,
  className,
  'data-tihoka-id': dataTestId,
}: BottomSheetProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => { onOpenChangeRef.current = onOpenChange; });
  useEffect(() => open ? pushEscapeLayer(() => onOpenChangeRef.current?.(false)) : undefined, [open]);

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
      role="presentation"
      data-tihoka-id={dataTestId}
    >
      <VStack
        ref={panelRef}
        gap="3"
        className={className ? `${styles.sheet} ${className}` : styles.sheet}
        onClick={handlePanelClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        {!hideDragHandle && <div className={styles.dragHandle} aria-hidden="true" />}
        {!hideHeader && (title || onOpenChange) && (
          <HStack
            align="center"
            justify={centerTitle ? 'center' : 'between'}
            gap="2"
            className={centerTitle ? `${styles.header} ${styles.headerCenterTitle}` : styles.header}
          >
            {title && (
              <Heading level={2} id="bottom-sheet-title" className={styles.title}>{title}</Heading>
            )}
            <CloseButton
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
              className={centerTitle ? styles.closeButtonAbsolute : styles.closeIcon}
            />
          </HStack>
        )}
        {children && <VStack gap="3">{children}</VStack>}
        {footer && <HStack align="center" justify="between" gap="2" className={styles.footer}>{footer}</HStack>}
      </VStack>
    </Flex>
  );
}
