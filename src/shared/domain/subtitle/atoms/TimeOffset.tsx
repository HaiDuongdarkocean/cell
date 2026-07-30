import type { ReactElement } from 'react';
import styles from './TimeOffset.module.css';

export interface TimeOffsetProps {
  /** Offset in seconds. Positive = subtitles delayed, negative = advanced. */
  offset: number;
  /** Display format: "absolute" shows total seconds, "relative" shows mm:ss. Default: absolute. */
  format?: 'absolute' | 'relative';
  /** When true, prefix with + or − sign. Default: true. */
  showSign?: boolean;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-testid for testing. */
  dataTestId?: string;
  /** Optional extra class name. */
  className?: string;
}

function formatRelative(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = Math.floor(abs % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatAbsolute(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  return `${abs.toFixed(1)}s`;
}

/**
 * TimeOffset — displays a subtitle time offset value using a monospace
 * font with tabular-nums for stable alignment. The sign (+/−) is colored
 * with accent (positive) or error (negative) when `showSign` is enabled.
 */
export function TimeOffset({
  offset,
  format = 'absolute',
  showSign = true,
  id,
  dataTestId,
  className,
}: TimeOffsetProps): ReactElement {
  const isNegative = offset < 0;
  const isZero = offset === 0;
  const magnitudeText =
    format === 'relative' ? formatRelative(offset) : formatAbsolute(offset);

  const signSymbol = isZero ? '±' : isNegative ? '−' : '+';

  const signClass = isZero
    ? styles.signZero
    : isNegative
      ? styles.signNegative
      : styles.signPositive;

  const cls = [styles.timeOffset, className ?? ''].filter(Boolean).join(' ');

  return (
    <span
      id={id}
      data-testid={dataTestId}
      className={cls}
      role="text"
      aria-label={`Time offset: ${offset} seconds`}
    >
      {showSign && <span className={signClass} aria-hidden="true">{signSymbol}</span>}
      <span className={styles.value}>{magnitudeText}</span>
    </span>
  );
}
