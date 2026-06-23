import type { DownloadStatus } from '@/types/media';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
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

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const statusClass = statusClassMap[status];

  return (
    <span data-testid="status-badge" className={`${styles.badge} ${statusClass}`}>
      {capitalize(status)}
    </span>
  );
}
