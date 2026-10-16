import type { ReactElement, ReactNode } from 'react';
import styles from './SegmentedControl.module.css';

export type SegmentedControlVariant = 'raised' | 'accent' | 'filled' | 'chips';

export interface SegmentedOption<T extends string> {
  /** Option value. */
  readonly value: T;
  /** Visible label. */
  readonly label: ReactNode;
  /** Optional per-option accessible label (icon-only or verbose labels). */
  readonly ariaLabel?: string;
  /** Optional native tooltip. */
  readonly title?: string;
  /** data-tihoka-id for tests. */
  readonly testId?: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Segments, in display order. */
  readonly options: readonly SegmentedOption<T>[];
  /** Currently selected value — `null` selects nothing (first segment stays tabbable). */
  readonly value: T | null;
  /** Called when user selects a segment (click or arrow keys). */
  readonly onChange: (value: T) => void;
  /** Visual skin. Default: `raised` (Apple HIG — elevated segment on tinted track). */
  readonly variant?: SegmentedControlVariant;
  /** Option size — `md` = 32px, `lg` = 40px (touch target) pills. Only the `chips` variant sizes options. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** Accessible group label (rendered as `aria-label` on the radiogroup). */
  readonly ariaLabel: string;
  readonly className?: string;
  /** data-tihoka-id for the group element. */
  readonly 'data-tihoka-id'?: string;
}

/**
 * SegmentedControl — single-choice segmented button strip (Apple HIG pattern).
 *
 * The ONE canonical implementation for "pick 1 of N" segmented controls —
 * do not re-skin per feature. Three variants cover the surfaces that existed:
 * - `raised`  — active segment floats (surface + shadow) on a tinted track.
 * - `accent`  — active segment tinted `primary-subtle` on an elevated track.
 * - `filled`  — active segment `primary-subtle` tint on a tinted track; wraps.
 * - `chips`   — no track; separate field-bg pills, active = `primary-subtle`.
 *
 * Semantics: `radiogroup` + `radio`, roving tabindex, Arrow/Home/End keys
 * move AND select (shadow-DOM safe — navigation uses DOM siblings).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'raised',
  size = 'sm',
  ariaLabel,
  className,
  'data-tihoka-id': dataTihokaId,
}: SegmentedControlProps<T>): ReactElement {
  const rootCls = [styles.root, styles[variant], className ?? ''].filter(Boolean).join(' ');
  const activeIdx = options.findIndex((o) => o.value === value);
  const focusIdx = activeIdx >= 0 ? activeIdx : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const segments = Array.from(
      e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
    );
    const current = segments.indexOf(e.currentTarget as HTMLButtonElement);
    const last = segments.length - 1;
    if (current < 0 || last < 0) return;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? last : (current + dir + segments.length) % segments.length;
    const target = segments[next];
    const nextValue = target.dataset.value as T;
    onChange(nextValue);
    target.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={rootCls} data-tihoka-id={dataTihokaId}>
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.ariaLabel}
          title={option.title}
          tabIndex={i === focusIdx ? 0 : -1}
          data-value={option.value}
          data-tihoka-id={option.testId}
          data-compact-hit={variant === 'chips' || undefined}
          className={
            variant === 'chips'
              ? [
                  { sm: styles.chipOption, md: styles.chipOptionMd, lg: styles.chipOptionLg }[size],
                  option.value === value ? styles.chipOptionActive : '',
                ].filter(Boolean).join(' ')
              : `${styles.segment} ${option.value === value ? styles.segmentActive : ''}`
          }
          onClick={() => onChange(option.value)}
          onKeyDown={handleKeyDown}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
