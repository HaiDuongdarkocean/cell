import type { HTMLAttributes } from 'react';
import styles from './Progress.module.css';

type ProgressSize = 'sm' | 'md' | 'lg';
type ProgressColor = 'accent' | 'success' | 'warning' | 'error';
type ProgressVariant = 'linear' | 'circular';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Current value. */
  value?: number;
  /** Maximum value. Default: 100. */
  max?: number;
  /** Bar height (linear) / stroke-width (circular). Default: md. */
  size?: ProgressSize;
  /** Fill color. Default: accent. */
  color?: ProgressColor;
  /** Display variant. Default: linear. */
  variant?: ProgressVariant;
  /** Indeterminate animation. */
  indeterminate?: boolean;
}

/** Circular viewBox constants — 36×36 grid, center 18,18, radius 16. */
const CIRCULAR_RADIUS = 16;
const CIRCULAR_CIRCUMFERENCE = 2 * Math.PI * CIRCULAR_RADIUS;
const CIRCULAR_STROKE_WIDTH: Record<ProgressSize, number> = { sm: 4, md: 6, lg: 8 };

/**
 * Progress — progress indicator (linear bar or circular ring).
 */
export function Progress({
  value = 0,
  max = 100,
  size = 'md',
  color = 'accent',
  variant = 'linear',
  indeterminate,
  className,
  ...rest
}: ProgressProps): React.JSX.Element {
  const percentage = max === 0 ? 0 : Math.min(Math.max((value / max) * 100, 0), 100);
  const rootCls = [styles.root, styles[size], styles[color], styles[variant], indeterminate ? styles.indeterminate : '', className ?? ''].filter(Boolean).join(' ');

  if (variant === 'circular') {
    const strokeWidth = CIRCULAR_STROKE_WIDTH[size];
    const offset = CIRCULAR_CIRCUMFERENCE - (percentage / 100) * CIRCULAR_CIRCUMFERENCE;
    return (
      <div
        className={rootCls}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        {...rest}
      >
        <svg className={styles.circularSvg} viewBox="0 0 36 36" fill="none">
          <circle
            className={styles.circularTrack}
            cx="18"
            cy="18"
            r={CIRCULAR_RADIUS}
            strokeWidth={strokeWidth}
          />
          <circle
            className={styles.circularBar}
            cx="18"
            cy="18"
            r={CIRCULAR_RADIUS}
            strokeWidth={strokeWidth}
            strokeDasharray={CIRCULAR_CIRCUMFERENCE}
            strokeDashoffset={indeterminate ? undefined : offset}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={rootCls}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...rest}
    >
      <div
        className={styles.bar}
        style={indeterminate ? undefined : { width: `${percentage}%` }}
      />
    </div>
  );
}
