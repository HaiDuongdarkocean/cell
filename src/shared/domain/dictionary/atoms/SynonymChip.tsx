import type { ButtonHTMLAttributes } from 'react';
import { Chip } from '@/shared/ui/Chip';

export interface SynonymChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The synonym word to display and look up. */
  word: string;
  /** Called when the user clicks the chip to look up the synonym. */
  onLookup?: (word: string) => void;
  /** Chip size. sm uses smaller padding + --font-size-xs, md uses --font-size-sm. */
  size?: 'sm' | 'md';
}

/**
 * SynonymChip — interactive pill button that triggers a dictionary lookup for a
 * synonym. Tinted green (success) to signal same-meaning relationship.
 *
 * Now a thin wrapper around `shared/ui/Chip`.
 */
export function SynonymChip({
  word,
  onLookup,
  onClick,
  size = 'md',
   
  color: _color,
  ...rest
}: SynonymChipProps): React.JSX.Element {
  return (
    <Chip
      as="button"
      color="success"
      size={size}
      aria-label={`Look up synonym: ${word}`}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onLookup?.(word);
      }}
      {...rest}
    >
      {word}
    </Chip>
  );
}
