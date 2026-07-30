import type { HTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './MasteryBadge.module.css';

export type MasteryLevel = 'beginner' | 'intermediate' | 'advanced' | 'master';
export type MasteryIcon = 'check' | 'checkDouble' | 'spinner';

export interface MasteryBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Mastery progress 0–100. Clamped to [0, 100]. */
  progress: number;
  /** Show the numeric progress value. Default: true. */
  showProgress?: boolean;
  /** Override the icon. Default: derived from level (check → checkDouble). */
  icon?: MasteryIcon;
}

function deriveLevel(progress: number): MasteryLevel {
  if (progress >= 76) return 'master';
  if (progress >= 51) return 'advanced';
  if (progress >= 26) return 'intermediate';
  return 'beginner';
}

function deriveIcon(level: MasteryLevel): MasteryIcon {
  if (level === 'master' || level === 'advanced') return 'checkDouble';
  return 'check';
}

/**
 * MasteryBadge — display-only badge showing a learner's mastery progress.
 * Level is derived from progress: beginner (0–25), intermediate (26–50),
 * advanced (51–75), master (76–100). Tint shifts from error → warning →
 * primary → success. Icon defaults to check / checkDouble; pass 'spinner' for
 * an in-progress state.
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
  const cls = [styles.badge, styles[level], className ?? ''].filter(Boolean).join(' ');

  return (
    <span
      className={cls}
      aria-label={`Mastery: ${clamped}%, level: ${level}`}
      {...rest}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon name={iconName === 'spinner' ? 'loader' : iconName} size={14} />
      </span>
      {showProgress && <span className={styles.progress}>{clamped}%</span>}
      {children && <span className={styles.label}>{children}</span>}
    </span>
  );
}
