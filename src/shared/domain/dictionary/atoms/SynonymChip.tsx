import type { ButtonHTMLAttributes } from 'react';
import styles from './SynonymChip.module.css';

export interface SynonymChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The synonym word to display and look up. */
  word: string;
  /** Called when the user clicks the chip to look up the synonym. */
  onLookup?: (word: string) => void;
}

/**
 * SynonymChip — interactive pill button that triggers a dictionary lookup for a
 * synonym. Tinted green (success) to signal same-meaning relationship.
 *
 * Touch target: 40px (adapts to 44px on coarse pointers via --touch-target).
 */
export function SynonymChip({
  word,
  onLookup,
  className,
  onClick,
  ...rest
}: SynonymChipProps): React.JSX.Element {
  const cls = [styles.chip, className ?? ''].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      aria-label={`Look up synonym: ${word}`}
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
