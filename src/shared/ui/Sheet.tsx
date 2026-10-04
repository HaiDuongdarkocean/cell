import { useCallback, useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { useSheet } from './useSheet';
import { useFocusTrap } from './useFocusTrap';
import { pushEscapeLayer } from './escapeLayerStack';
import { t } from '@/shared/i18n';
import styles from './Sheet.module.css';

export interface SheetProps {
  /** Whether the sheet is open (renders nothing when false). */
  readonly open: boolean;
  /** Called when the sheet requests close (drag dismiss, click handle, ESC). */
  readonly onClose?: () => void;
  /** Accessible name for the dialog (aria-label). */
  readonly 'aria-label'?: string;
  /** Initial sheet height in px. Default: 300. */
  readonly initialHeight?: number;
  /** Max sheet height in px. Default: viewport - margin. */
  readonly maxHeight?: number;
  /** Called when sheet height changes (for persistence). */
  readonly onHeightChange?: (height: number) => void;
  /** Content pinned between the drag handle and the scrollable content area
   *  (e.g. a breadcrumb trail). Stays fixed while content scrolls. */
  readonly header?: ReactNode;
  /** Whether this sheet claims dialog modality (aria-modal). Only the top
   *  sheet of a stacked set should be modal. Default: true. */
  readonly modal?: boolean;
  /** Render inert — removed from tab order and the accessibility tree. Use
   *  for covered stack levels. Default: false. */
  readonly inert?: boolean;
  /** Sheet content. */
  readonly children?: ReactNode;
  /** Custom className for the sheet container (extends styles.sheet). */
  readonly className?: string;
  /** Custom className for the content area. */
  readonly contentClassName?: string;
  /** Test id. */
  readonly 'data-cell-id'?: string;
}

/**
 * Sheet — shared bottom sheet atom (SSOT).
 * 94% width centered, slide-up from bottom, all 4 corners rounded.
 * Drag handle: 1:1 height resize + click-to-close.
 * Content drag: translateY dismiss + spring snap-back.
 * Used by: Dictionary popup (mobile), SubtitleManager (mobile).
 */
export function Sheet({
  open,
  onClose,
  'aria-label': ariaLabel,
  initialHeight,
  maxHeight,
  onHeightChange,
  header,
  modal = true,
  inert = false,
  children,
  className,
  contentClassName,
  'data-cell-id': dataTestId,
}: SheetProps): React.JSX.Element | null {
  const {
    sheetRef,
    style,
    onPointerDownHandle,
    onKeyDownHandle,
    onPointerDownContent,
  } = useSheet({ initialHeight, maxHeight, onClose, onHeightChange });
  useFocusTrap(sheetRef, open);

  // A covered sheet is inert; when the stack pops back to it the attribute is
  // removed and the sheet becomes the interactive top again. Refocus it here —
  // callers can't time this themselves (the inert attr must be committed
  // before focus() works, and the trap doesn't re-fire while `open` is stable).
  const wasInertRef = useRef(inert);
  useEffect(() => {
    if (wasInertRef.current && !inert && sheetRef.current) {
      if (sheetRef.current.tabIndex < 0) sheetRef.current.tabIndex = -1;
      sheetRef.current.focus();
    }
    wasInertRef.current = inert;
  }, [inert, sheetRef]);

  // Stop non-Escape keyboard events from leaking to the host page while the
  // sheet is open. The drag handle and content may need arrow/Enter/Space;
  // those fire on children before the event reaches this handler.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') return;
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') return;
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  }, []);

  // ESC to close — fullscreen-aware (let browser exit fullscreen first).
  // Registered on the shared Escape stack so the sheet consumes the key
  // without letting it bubble to ancestor surfaces (e.g. UniversalPanel).
  useEffect(() => {
    if (!open) return;
    return pushEscapeLayer(() => {
      if (document.fullscreenElement) return;
      onClose?.();
    });
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        ref={sheetRef}
        className={className ? `${styles.sheet} ${className}` : styles.sheet}
        role="dialog"
        aria-modal={modal ? 'true' : undefined}
        aria-label={ariaLabel}
        inert={inert}
        data-cell-id={dataTestId}
        style={style}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <div
          className={styles.handle}
          role="separator"
          aria-orientation="horizontal"
          tabIndex={0}
          aria-label={t('ui.sheet.resizeAria')}
          onPointerDown={onPointerDownHandle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClose?.();
              return;
            }
            onKeyDownHandle(e);
          }}
        />
        {header}
        <div
          className={contentClassName ? `${styles.content} ${contentClassName}` : styles.content}
          onPointerDown={onPointerDownContent}
        >
          {children}
        </div>
      </div>
      {inert ? (
        // Inert subtrees are skipped by hit-testing — without this catcher a
        // tap on a covered sheet's exposed area would land on the page behind
        // it (a page lookup could reset the whole stack). The catcher sits
        // inside this host so the stack's pointer routing sees the tap and
        // pops back to this level instead.
        <div
          className={styles.cover}
          style={{ height: style.height, maxHeight: style.maxHeight, transform: style.transform }}
          data-cell-id="sheet-inert-cover"
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
