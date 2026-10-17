import { t } from '@/shared/i18n';
import { formatMediaTimeSec } from '@/shared/lib/formatMediaTime';
import styles from './TimeDisplay.module.css';

type TimeDisplayFormat = 'current' | 'remaining' | 'both';

interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  format?: TimeDisplayFormat;
  className?: string;
}

export function formatTime(seconds: number): string {
  return formatMediaTimeSec(seconds);
}

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
    <time className={cls} dateTime={datetime} role="timer" aria-label={t('video.time.currentAria', [label])}>
      {label}
    </time>
  );
}
