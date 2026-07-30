import type { ButtonHTMLAttributes } from 'react';
import styles from './AntonymChip.module.css';

export interface AntonymChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The antonym word to display and look up. */
  word: string;
  /** Called when the user clicks the chip to look up the antonym. */
  onLookup?: (word: string) => void;
  /** Chip size. sm uses smaller padding + --font-size-xs, md uses --font-size-sm. */
  size?: 'sm' | 'md';
}

/**
 * AntonymChip — interactive pill button that triggers a dictionary lookup for an
 * antonym. Tinted red (error) to signal opposite-meaning relationship.
 *
 * Touch target: 40px (adapts to 44px on coarse pointers via --touch-target).
 */
export function AntonymChip({
  word,
  onLookup,
  className,
  onClick,
  size = 'md',
  ...rest
}: AntonymChipProps): React.JSX.Element {
  const cls = [styles.chip, styles[size], className ?? ''].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      aria-label={`Look up antonym: ${word}`}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onLookup?.(word);
      }}
      {...rest}
    >
      {word}
    </button>
  );
}
