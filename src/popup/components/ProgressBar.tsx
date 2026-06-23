import type { DownloadStatus } from '@/types/media';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  /** Progress value from 0 to 100. */
  progress: number;
  status: DownloadStatus;
}

const statusClassMap: Readonly<Record<DownloadStatus, string>> = {
  downloading: styles.downloading ?? 'downloading',
  converting: styles.converting ?? 'converting',
  done: styles.done ?? 'done',
  error: styles.error ?? 'error',
  cancelled: styles.cancelled ?? 'cancelled',
  paused: styles.paused ?? 'paused',
  queued: styles.queued ?? 'queued',
};

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function ProgressBar({ progress, status }: ProgressBarProps): React.JSX.Element {
  const clamped = clampProgress(progress);
  const statusClass = statusClassMap[status];

  return (
    <div className={styles.wrapper}>
      <div data-testid="progress-bar" className={styles.container}>
        <div
          data-testid="progress-fill"
          className={`${styles.fill} ${statusClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span data-testid="progress-status" className={styles.statusText}>
        {status}
      </span>
    </div>
  );
}
