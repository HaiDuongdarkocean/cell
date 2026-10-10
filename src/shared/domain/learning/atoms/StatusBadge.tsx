import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Chip } from '@/shared/ui/Chip';
import type { ChipColor } from '@/shared/ui/Chip';
import { t, type MessageKey } from '@/shared/i18n';

export type { WordStatus } from '@/entities/dictionary';
import type { WordStatus } from '@/entities/dictionary';

const statusToLabel: Record<WordStatus, MessageKey> = {
  unknown: 'vocabulary.status.unknown',
  tracking: 'vocabulary.status.tracking',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
};

export interface StatusBadgeProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'color'> {
  /** Word knowledge status. Default: unknown. */
  status?: WordStatus;
  children?: ReactNode;
}

const statusToColor: Record<WordStatus, ChipColor> = {
  unknown: 'muted',
  tracking: 'warning',
  known: 'success',
  ignore: 'error',
};

/**
 * StatusBadge — clickable pill that shows word knowledge status.
 * Uses the shared Chip atom with color mapped from status.
 */
export function StatusBadge({
  status = 'unknown',
  className,
  children,
  ...rest
}: StatusBadgeProps): React.JSX.Element {
  const color = statusToColor[status];

  return (
    <Chip
      as="button"
      size="sm"
      color={color}
      className={className}
      {...rest}
    >
      {children ?? t(statusToLabel[status])}
    </Chip>
  );
}
