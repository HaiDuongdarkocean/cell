import type { ButtonHTMLAttributes } from 'react';
import { Chip } from '@/shared/ui/Chip';

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
 * Now a thin wrapper around `shared/ui/Chip`.
 */
export function AntonymChip({
  word,
  onLookup,
  onClick,
  size = 'md',
   
  color: _color,
  ...rest
}: AntonymChipProps): React.JSX.Element {
  return (
    <Chip
      as="button"
      color="error"
      size={size}
      aria-label={`Look up antonym: ${word}`}
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
