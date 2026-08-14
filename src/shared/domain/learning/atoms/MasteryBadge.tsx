import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import { Chip } from '@/shared/ui/Chip';
import type { ChipColor } from '@/shared/ui/Chip';

export type MasteryLevel = 'beginner' | 'intermediate' | 'advanced' | 'master';
export type MasteryIcon = 'check' | 'checkDouble' | 'spinner';

export interface MasteryBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'color'> {
  /** Mastery progress 0–100. Clamped to [0, 100]. */
  progress: number;
  /** Show the numeric progress value. Default: true. */
  showProgress?: boolean;
  /** Override the icon. Default: derived from level (check → checkDouble). */
  icon?: MasteryIcon;
  children?: ReactNode;
}

const LEVEL_RANGES: Array<{ threshold: number; level: MasteryLevel }> = [
  { threshold: 76, level: 'master' },
  { threshold: 51, level: 'advanced' },
  { threshold: 26, level: 'intermediate' },
];

function deriveLevel(progress: number): MasteryLevel {
  for (const { threshold, level } of LEVEL_RANGES) {
    if (progress >= threshold) return level;
  }
  return 'beginner';
}

function deriveIcon(level: MasteryLevel): MasteryIcon {
  if (level === 'master' || level === 'advanced') return 'checkDouble';
  return 'check';
}

const levelToColor = {
  beginner: 'error',
  intermediate: 'warning',
  advanced: 'primary',
  master: 'success',
} as const satisfies Record<MasteryLevel, ChipColor>;

/**
 * MasteryBadge — display-only badge showing a learner's mastery progress.
 * Level is derived from progress: beginner (0–25), intermediate (26–50),
 * advanced (51–75), master (76–100). Color maps to the shared Chip palette.
 * Icon defaults to check / checkDouble; pass 'spinner' for an in-progress state.
 */
export function MasteryBadge({
  progress,
  showProgress = true,
  icon,
  className,
  children,
  ...rest
}: MasteryBadgeProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const level = deriveLevel(clamped);
  const iconName = icon ?? deriveIcon(level);
  const color: ChipColor = levelToColor[level];

  const leadingIcon = iconName === 'spinner' ? (
    <Spinner size="sm" color="current" aria-hidden="true" />
  ) : (
    <Icon name={iconName} size={14} />
  );

  return (
    <Chip
      as="span"
      size="sm"
      color={color}
      leadingIcon={leadingIcon}
      aria-label={`Mastery: ${clamped}%, level: ${level}`}
      className={className}
      {...rest}
    >
      {showProgress && <span>{clamped}%</span>}
      {children}
    </Chip>
  );
}
