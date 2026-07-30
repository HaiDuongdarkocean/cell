import styles from './TimeDisplay.module.css';

type TimeDisplayFormat = 'current' | 'remaining' | 'both';

interface TimeDisplayProps {
  /** Current playback position in seconds. */
  currentTime: number;
  /** Total media duration in seconds. */
  duration: number;
  /** Display format. Default 'both'. */
  format?: TimeDisplayFormat;
  className?: string;
}

/** Format seconds as M:SS or H:MM:SS. Pure function — easy to test. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * TimeDisplay — domain video atom (atom-design-plan §6.A.3).
 *
 * Renders the current time, remaining time, or both using a `<time>` element.
 * Uses the monospace code font token + `tabular-nums` so digits don't shift.
 *
 * Formats: `current` → "1:23", `remaining` → "-0:37", `both` → "1:23 / 2:00".
 */
export function TimeDisplay({
  currentTime,
  duration,
  format = 'both',
  className,
}: TimeDisplayProps): React.JSX.Element {
  const current = formatTime(currentTime);
  const remaining = formatTime(Math.max(0, duration - currentTime));
  const total = formatTime(duration);

  let label: string;
  let datetime: string;

  if (format === 'current') {
    label = current;
    datetime = `PT${Math.round(currentTime)}S`;
  } else if (format === 'remaining') {
    label = `-${remaining}`;
    datetime = `PT${Math.round(Math.max(0, duration - currentTime))}S`;
  } else {
    label = `${current} / ${total}`;
    datetime = `PT${Math.round(currentTime)}S`;
  }

  const cls = [styles.display, className ?? ''].filter(Boolean).join(' ');

  return (
    <time className={cls} dateTime={datetime} role="timer" aria-label={`Current time ${label}`}>
      {label}
    </time>
  );
}
