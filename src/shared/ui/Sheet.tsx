import { useEffect, type ReactNode } from 'react';
import { useSheet } from './useSheet';
import styles from './Sheet.module.css';

export interface SheetProps {
  /** Whether the sheet is open (renders nothing when false). */
  readonly open: boolean;
  /** Called when the sheet requests close (drag dismiss, click handle, ESC). */
  readonly onClose?: () => void;
  /** Initial sheet height in px. Default: 300. */
  readonly initialHeight?: number;
  /** Max sheet height in px. Default: viewport - margin. */
  readonly maxHeight?: number;
  /** Called when sheet height changes (for persistence). */
  readonly onHeightChange?: (height: number) => void;
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
  initialHeight,
  maxHeight,
  onHeightChange,
  children,
  className,
  contentClassName,
  'data-cell-id': dataTestId,
}: SheetProps): React.JSX.Element | null {
  const {
    sheetRef,
    style,
    onPointerDownHandle,
    onPointerDownContent,
  } = useSheet({ initialHeight, maxHeight, onClose, onHeightChange });

  // ESC to close — fullscreen-aware (let browser exit fullscreen first).
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) return;
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={sheetRef}
      className={className ? `${styles.sheet} ${className}` : styles.sheet}
      role="dialog"
      aria-modal="true"
      data-cell-id={dataTestId}
      style={style}
    >
      <div
        className={styles.handle}
        aria-hidden="true"
        onPointerDown={onPointerDownHandle}
      />
      <div
        className={contentClassName ? `${styles.content} ${contentClassName}` : styles.content}
        onPointerDown={onPointerDownContent}
      >
        {children}
      </div>
    </div>
  );
}
