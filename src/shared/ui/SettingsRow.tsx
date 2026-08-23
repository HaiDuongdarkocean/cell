import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import styles from './SettingsRow.module.css';

export interface SettingsRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  /** Row content — each direct child is a horizontal part. */
  children: ReactNode;
  /** Top hairline divider (between rows in a card). Default: false. */
  divider?: boolean;
  /** Vertical stack: parts stack top-to-bottom (slider rows: header on top, slider below). Default: false. */
  stacked?: boolean;
  /** Remove padding — for nested rows inside a stacked parent. Default: false. */
  flush?: boolean;
  /** Compact padding (8px 12px) — for dense grids like pairRow. Reduces within-group spacing per Gestalt proximity. Default: false. */
  compact?: boolean;
  /** Dense padding (0 16px) — vertical 0, parent gap owns spacing. M3 Box Contract: container padding 0, gap controls. Default: false. */
  dense?: boolean;
  className?: string;
}

/**
 * SettingsRow — horizontal row that distributes children into N parts with
 * `space-between`. Set `stacked` for slider rows (header on top, slider below).
 *
 * Consumes tokens only. Matches iOS Settings card pattern used across panels.
 */
export const SettingsRow = forwardRef<HTMLDivElement, SettingsRowProps>(function SettingsRow(
  { children, divider = false, stacked = false, flush = false, compact = false, dense = false, className, ...rest },
  ref: Ref<HTMLDivElement>,
): React.JSX.Element {
  const cls = [
    styles.row,
    stacked ? styles.stacked : '',
    divider ? styles.divider : '',
    flush ? styles.flush : '',
    compact ? styles.compact : '',
    dense ? styles.dense : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={cls} {...rest}>
      {children}
    </div>
  );
});
