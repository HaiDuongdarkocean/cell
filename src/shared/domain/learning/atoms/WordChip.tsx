import type { ButtonHTMLAttributes } from 'react';
import styles from './WordChip.module.css';

export type WordStatus = 'new' | 'learning' | 'mastered' | 'unknown';

export interface WordChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The word to display and look up. */
  word: string;
  /** Learning status of the word. Default: unknown. */
  status?: WordStatus;
  /** Called when the user clicks the chip to look up the word. */
  onLookup?: (word: string) => void;
}

/**
 * WordChip — interactive pill button that triggers a dictionary lookup for a
 * word. Tint color reflects the learner's current status with the word.
 *
 * Touch target: 40px (adapts to 44px on coarse pointers via --touch-target).
 */
export function WordChip({
  word,
  status = 'unknown',
  onLookup,
  className,
  onClick,
  ...rest
}: WordChipProps): React.JSX.Element {
  const cls = [styles.chip, styles[status], className ?? ''].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      aria-label={`Look up ${word}, status: ${status}`}
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
