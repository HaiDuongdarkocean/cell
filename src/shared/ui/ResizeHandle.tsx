import { useCallback } from 'react';
import type { HTMLAttributes, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import styles from './ResizeHandle.module.css';

type ResizeDirection = 'horizontal' | 'vertical';
type ResizeHandleSize = 'sm' | 'md';

interface ResizeHandleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'tabIndex' | 'onKeyDown'> {
  /** Orientation of the resize axis. Default 'horizontal'. */
  direction?: ResizeDirection;
  /** Thickness: sm=thinner hit area, md=current. Default 'md'. */
  size?: ResizeHandleSize;
  /** Accessible label. Default "Resize". */
  'aria-label'?: string;
  /** Called on pointer down (start of resize drag). */
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** Called when Shift+Arrow is pressed (keyboard resize). */
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * ResizeHandle — a separator bar that resizes an adjacent panel via pointer drag
 * or keyboard.
 *
 * Renders a `<div role="separator">` with `aria-orientation` matching `direction`.
 * Pointer events are captured for drag-based resizing. Keyboard users can resize
 * with Shift+Arrow keys (handled by the consumer via `onKeyDown`).
 */
export function ResizeHandle({
  direction = 'horizontal',
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Resize',
  onKeyDown,
  ...rest
}: ResizeHandleProps): React.JSX.Element {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        onKeyDown?.(e);
      }
    },
    [onKeyDown],
  );

  const cls = [styles.resizeHandle, styles[direction], styles[size], className ?? ''].filter(Boolean).join(' ');

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={direction}
      aria-label={ariaLabel}
      className={cls}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
}
