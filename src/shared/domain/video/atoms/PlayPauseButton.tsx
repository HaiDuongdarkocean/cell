import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import styles from './PlayPauseButton.module.css';

interface PlayPauseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Controlled playback state. true = playing (shows pause icon), false = paused (shows play icon). */
  playing: boolean;
  /** Buffering/loading state. When true, shows a spinner and disables interaction. */
  loading?: boolean;
}

/**
 * PlayPauseButton — domain video atom (atom-design-plan §6.A.1).
 *
 * Controlled toggle: caller owns `playing` state and flips it via `onPlayPause`.
 * Shows `play` icon when paused, `pause` icon when playing. When `loading` is
 * true (buffering), renders a Spinner and blocks clicks.
 *
 * Accessibility: dynamic `aria-label` ("Play" / "Pause"), `aria-busy` when
 * buffering, 40px touch target.
 */
export function PlayPauseButton({
  playing,
  loading = false,
  disabled,
  className,
  onClick,
  ...rest
}: PlayPauseButtonProps): React.JSX.Element {
  const label = playing ? 'Pause' : 'Play';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (loading) return;
    onClick?.(e);
  };

  const cls = [styles.button, loading ? styles.loading : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={handleClick}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" className={styles.spinner} />
      ) : (
        <Icon name={playing ? 'pause' : 'play'} size={24} className={styles.icon} />
      )}
    </button>
  );
}
