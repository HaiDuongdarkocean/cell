import { type ReactNode, useCallback, useRef, useState } from 'react';
import { LabelGroup } from './LabelGroup';
import { Slider } from './Slider';
import styles from './SliderRow.module.css';

export interface SliderRowProps {
  /** Leading icon (20×20 slot). */
  icon?: ReactNode;
  /** Primary label text. */
  label: ReactNode;
  /** Hint text shown in a click-tooltip on info icon next to label. */
  hint?: ReactNode;
  /** Current numeric value. */
  value: number;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** Step increment. */
  step: number;
  /** Called with the new numeric value when user drags/changes. */
  onChange: (value: number) => void;
  /** Accessible label for the slider input. */
  'aria-label': string;
  /** Value display variant:
   *  - `'end'` (default): value at end of track, same line as bar.
   *  - `'bubble'`: value in a bubble above thumb, shown on hover/drag.
   */
  variant?: 'end' | 'bubble';
  /** Format function for display value. Default: `${value}%`. */
  formatValue?: (value: number) => string;
  /** Top hairline divider. Default: false. */
  divider?: boolean;
  /** Disable the slider (mờ, không kéo được). */
  disabled?: boolean;
  /** Note text shown below slider when disabled — guides user on how to enable. */
  disabledNote?: ReactNode;
  /** Extra class on the root. */
  className?: string;
}

/**
 * SliderRow — LabelGroup (header) + Slider (content), composed.
 *
 * Header: `LabelGroup` with icon + label + hint (click-tooltip).
 * Content: `Slider` with value display — two variants:
 * - `variant='end'`: value text at end of track (same line as bar).
 * - `variant='bubble'`: value in a blue bubble above thumb, shown on hover/drag.
 *
 * Consumes tokens only. Replaces manual SettingsRow + LabelGroup + Slider composition.
 */
export function SliderRow({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  'aria-label': ariaLabel,
  variant = 'end',
  formatValue,
  divider = false,
  disabled = false,
  disabledNote,
  className,
}: SliderRowProps): React.JSX.Element {
  const fmt = formatValue ?? ((v: number) => `${v}%`);
  const displayValue = fmt(value);
  const range = max - min;
  const progress = range > 0 ? ((value - min) / range) * 100 : 0;

  // Bubble variant: track hover/drag state + thumb position
  const [showBubble, setShowBubble] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Edge-corrected bubble position (CSS-Tricks formula)
  const bubbleLeft = `calc(${progress}% + (${8 - progress * 0.15}px))`;

  const handlePointerEnter = useCallback(() => setShowBubble(true), []);
  const handlePointerLeave = useCallback(() => setShowBubble(false), []);

  const cls = [
    styles.row,
    divider ? styles.divider : '',
    disabled ? styles.disabled : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} data-disabled={disabled || undefined}>
      {/* Header — LabelGroup: icon + label + hint */}
      <LabelGroup icon={icon} label={label} hint={hint} />

      {/* Content — Slider + value */}
      {variant === 'end' ? (
        <div className={styles.sliderRow}>
          <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={onChange}
            aria-label={ariaLabel}
            className={styles.slider}
            disabled={disabled}
          />
          <span className={styles.valueEnd}>{displayValue}</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={styles.sliderContainer}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          {showBubble && !disabled && (
            <span className={styles.bubble} style={{ left: bubbleLeft }}>
              {displayValue}
            </span>
          )}
          <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={onChange}
            aria-label={ariaLabel}
            className={styles.slider}
            disabled={disabled}
            onFocus={() => setShowBubble(true)}
            onBlur={() => setShowBubble(false)}
          />
        </div>
      )}

      {/* Disabled note — small guide text below slider */}
      {disabled && disabledNote && (
        <p className={styles.disabledNote}>{disabledNote}</p>
      )}
    </div>
  );
}
