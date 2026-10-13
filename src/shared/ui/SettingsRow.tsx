import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { HintIcon } from './HintIcon';
import styles from './SettingsRow.module.css';

export interface SettingsRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'title'> {
  /** Row content — each direct child is a horizontal part. When `title` is set,
   *  a canonical "title + optional description" lead part is rendered first. */
  children: ReactNode;
  /** Setting name. Renders as the canonical row label (sm medium). */
  title?: ReactNode;
  /** Visible supporting text under the title (sm secondary). */
  description?: ReactNode;
  /** Secondary explanation behind a ⓘ popover next to the title. */
  hint?: string;
  hintAriaLabel?: string;
  /** data-tihoka-id for the hint trigger button. */
  hintTestId?: string;
  /** When set, the title renders as a <label htmlFor> bound to a control id. */
  labelFor?: string;
  /** Top hairline divider (between rows in a card). Default: false. */
  divider?: boolean;
  /** Vertical stack: parts stack top-to-bottom (slider rows: header on top, slider below). Default: false. */
  stacked?: boolean;
  /** Remove padding — for nested rows inside a stacked parent. Default: false. */
  flush?: boolean;
  /** Compact padding (8px 12px) — for dense grids like pairRow. Reduces within-group spacing per Gestalt proximity. Default: false. */
  compact?: boolean;
  /** Dense padding — horizontal 0, modest vertical gap; parent owns the outer spacing. Default: false. */
  dense?: boolean;
  /** Indented child row (conditional sub-field) — replaces bespoke .childField recipes. Default: false. */
  child?: boolean;
  className?: string;
}

/**
 * SettingsRow — horizontal row that distributes children into N parts with
 * `space-between`. Set `stacked` for slider rows (header on top, slider below).
 * Pass `title`/`description`/`hint` for the canonical "label left, control
 * right" settings anatomy; children still carry the trailing control.
 *
 * Consumes tokens only. Matches iOS Settings card pattern used across panels.
 */
export const SettingsRow = forwardRef<HTMLDivElement, SettingsRowProps>(function SettingsRow(
  {
    children,
    title,
    description,
    hint,
    hintAriaLabel,
    hintTestId,
    labelFor,
    divider = false,
    stacked = false,
    flush = false,
    compact = false,
    dense = false,
    child = false,
    className,
    ...rest
  },
  ref: Ref<HTMLDivElement>,
): React.JSX.Element {
  const cls = [
    styles.row,
    stacked ? styles.stacked : '',
    divider ? styles.divider : '',
    flush ? styles.flush : '',
    compact ? styles.compact : '',
    dense ? styles.dense : '',
    child ? styles.child : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  const titleEl = (
    <span className={styles.title}>
      {labelFor ? <label htmlFor={labelFor}>{title}</label> : title}
      {hint && <HintIcon hint={hint} ariaLabel={hintAriaLabel ?? hint} dataTestId={hintTestId} />}
    </span>
  );

  return (
    <div ref={ref} className={cls} {...rest}>
      {(title || description || hint) && (
        <div className={styles.lead}>
          {titleEl}
          {description && <span className={styles.description}>{description}</span>}
        </div>
      )}
      {children}
    </div>
  );
});
