import { useCallback } from 'react';
import type { HTMLAttributes, KeyboardEvent } from 'react';
import styles from './DragHandle.module.css';

interface DragHandleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'tabIndex' | 'onKeyDown'> {
  /** Accessible label for the drag handle. Default "Drag". */
  'aria-label'?: string;
  /** Called when an arrow key is pressed (keyboard reorder). */
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * DragHandle — a draggable grip bar that reorders list items or panels.
 *
 * Renders a `<div role="button">` with `draggable="true"`, CSS grip dots, and
 * keyboard arrow-key support. Touch target meets 40px (desktop) / 44px (mobile).
 */
export function DragHandle({
  className,
  'aria-label': ariaLabel = 'Drag',
  onKeyDown,
  ...rest
}: DragHandleProps): React.JSX.Element {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
    },
    [onKeyDown],
  );

  const cls = [styles.dragHandle, className ?? ''].filter(Boolean).join(' ');

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      aria-label={ariaLabel}
      className={cls}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <span className={styles.gripDots} aria-hidden="true" />
    </div>
  );
}
