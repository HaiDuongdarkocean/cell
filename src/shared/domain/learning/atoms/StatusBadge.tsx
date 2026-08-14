import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Chip } from '@/shared/ui/Chip';
import type { ChipColor } from '@/shared/ui/Chip';

export type WordStatus = 'unknown' | 'tracking' | 'known' | 'ignore';

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
      {children ?? status}
    </Chip>
  );
}
