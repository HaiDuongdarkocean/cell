import type { ReactElement } from 'react';
import styles from './PaginationDots.module.css';

export interface PaginationDotsProps {
  /** Total number of items. */
  readonly count: number;
  /** Active item index (0-based). */
  readonly active: number;
  /** Called when a dot is activated. Receives the target 0-based index.
   *  Omit to render a read-only indicator. */
  readonly onSelect?: (index: number) => void;
  /** Accessible label for the dot group, e.g. "2 / 5". */
  readonly label?: string;
  /** Accessible label per dot, e.g. `(i) => \`Go to image ${i + 1}\``. */
  readonly itemLabel?: (index: number) => string;
  readonly className?: string;
}

export function PaginationDots({
  count,
  active,
  onSelect,
  label,
  itemLabel,
  className,
}: PaginationDotsProps): ReactElement | null {
  if (count <= 0) return null;

  return (
    <div
      className={`${styles.dots} ${className ?? ''}`.trim()}
      role="group"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === active;
        const cls = `${styles.dot} ${isActive ? styles.dotActive : ''}`;
        if (!onSelect) {
          return <span key={i} className={cls} aria-hidden="true" />;
        }
        return (
          <button
            key={i}
            type="button"
            className={cls}
            aria-label={itemLabel?.(i)}
            aria-current={isActive}
            onClick={() => onSelect(i)}
          />
        );
      })}
    </div>
  );
}
