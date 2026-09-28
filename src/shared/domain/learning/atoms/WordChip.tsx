import type { ButtonHTMLAttributes } from 'react';
import { Chip } from '@/shared/ui/Chip';
import type { ChipColor } from '@/shared/ui/Chip';
import { t, type MessageKey } from '@/shared/i18n';

export type WordStatus = 'new' | 'learning' | 'mastered' | 'unknown';

const statusToColor: Record<WordStatus, ChipColor> = {
  new: 'primary',
  learning: 'warning',
  mastered: 'success',
  unknown: 'muted',
};

const statusToLabel: Record<WordStatus, MessageKey> = {
  new: 'learning.status.new',
  learning: 'learning.status.learning',
  mastered: 'learning.status.mastered',
  unknown: 'vocabulary.status.unknown',
};

export interface WordChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size' | 'color'> {
  /** The word to display and look up. */
  word: string;
  /** Learning status of the word. Default: unknown. */
  status?: WordStatus;
  /** Chip size. Default: md. */
  size?: 'sm' | 'md';
  /** Called when the user clicks the chip to look up the word. */
  onLookup?: (word: string) => void;
}

/**
 * WordChip — interactive pill button that triggers a dictionary lookup for a
 * word. Tint color reflects the learner's current status with the word.
 *
 * Implemented as a thin wrapper over the shared `Chip` atom.
 *
 * Touch target: 40px (adapts to 44px on coarse pointers via --touch-target).
 */
export function WordChip({
  word,
  status = 'unknown',
  size = 'md',
  onLookup,
  className,
  onClick,
  ...rest
}: WordChipProps): React.JSX.Element {
  return (
    <Chip
      as="button"
      size={size}
      color={statusToColor[status]}
      className={className}
      aria-label={t('learning.wordChip.aria', [word, t(statusToLabel[status])])}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) onLookup?.(word);
      }}
      {...rest}
    >
      {word}
    </Chip>
  );
}
