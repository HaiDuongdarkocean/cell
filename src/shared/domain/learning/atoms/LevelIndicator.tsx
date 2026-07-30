import type { HTMLAttributes } from 'react';
import styles from './LevelIndicator.module.css';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface LevelIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  /** CEFR level (A1–C2). Default: A1. */
  level?: CefrLevel;
  /** Show the level label text alongside the indicator dot. Default: true. */
  showLabel?: boolean;
}

/**
 * LevelIndicator — display-only badge showing a CEFR proficiency level (A1–C2).
 * A colored dot + optional label; tint shifts from primary (A1) through warning
 * (B1/B2) to success (C1/C2) to visualize the progression.
 */
export function LevelIndicator({
  level = 'A1',
  showLabel = true,
  className,
  children,
  ...rest
}: LevelIndicatorProps): React.JSX.Element {
  const cls = [styles.indicator, styles[level], className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={cls} aria-label={`CEFR level: ${level}`} {...rest}>
      <span className={styles.dot} aria-hidden="true" />
      {showLabel && <span className={styles.label}>{children ?? level}</span>}
    </span>
  );
}
