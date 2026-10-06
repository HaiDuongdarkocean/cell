import { useEffect, useRef, type ReactNode } from 'react';
import { HStack } from './Stack';
import { CloseButton } from './CloseButton';
import { Surface } from './Surface';
import { useFocusTrap } from './useFocusTrap';
import { pushEscapeLayer } from './escapeLayerStack';
import styles from './Dialog.module.css';

interface DialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the dialog should close (overlay click, Esc, close button). */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title. */
  title?: string;
  /** Optional icon rendered left of the title/description block. */
  titleIcon?: ReactNode;
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
  /** Panel width variant — maps to --dialog-max-width{-sm,,-lg,-xl}. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Bound the panel to its max height and let children own their scroll
   *  regions — the panel itself never scrolls. Use for layouts whose panes
   *  scroll internally (e.g. a long fields column next to a card preview). */
  fill?: boolean;
  /** Id of an element inside `children` describing the dialog. Overrides the
   *  default `description`-based wiring. */
  'aria-describedby'?: string;
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
  titleIcon,
  description,
  children,
  footer,
  showCloseButton,
  headerExtra,
  centerTitle,
  size = 'md',
  fill = false,
  'aria-describedby': ariaDescribedBy,
  'data-cell-id': dataTestId,
}: DialogProps): React.JSX.Element | null {
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
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
      data-cell-id={dataTestId}
    >
      <Surface
        ref={panelRef}
        as="div"
        variant="dialog"
        className={[styles.panel, fill ? styles.panelFill : '', size === 'sm' ? styles.panelSm : size === 'lg' ? styles.panelLg : size === 'xl' ? styles.panelXl : ''].filter(Boolean).join(' ')}
        onClick={handlePanelClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={ariaDescribedBy ?? (description ? 'dialog-description' : undefined)}
      >
        {(title || showCloseButton) && (
          <HStack
            align="center"
            justify={centerTitle ? 'center' : 'between'}
            gap="3"
            className={centerTitle ? `${styles.header} ${styles.headerCenterTitle}` : styles.header}
          >
            {showCloseButton && centerTitle && (
              <HStack align="center" gap="1" className={styles.headerRightGroup}>
                {headerExtra}
                <CloseButton variant="ghost" onClick={() => onOpenChange?.(false)} />
              </HStack>
            )}
            <HStack align="center" gap="3" className={styles.headerTitleGroup}>
              {titleIcon && <span className={styles.titleIcon}>{titleIcon}</span>}
              <div className={styles.headerText}>
                {title && <h2 id="dialog-title" className={styles.title}>{title}</h2>}
                {description && <p id="dialog-description" className={styles.description}>{description}</p>}
              </div>
            </HStack>
            {showCloseButton && !centerTitle && (
              <HStack align="center" gap="1" className={styles.headerRightGroup}>
                {headerExtra}
                <CloseButton variant="ghost" onClick={() => onOpenChange?.(false)} />
              </HStack>
            )}
          </HStack>
        )}
        {children && <div className={styles.content}>{children}</div>}
        {footer && <HStack justify="end" gap="3" className={styles.footer}>{footer}</HStack>}
      </Surface>
    </div>
  );
}
