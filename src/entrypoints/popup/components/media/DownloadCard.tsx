import type { DownloadItem } from '@/entities/media';
import { formatFileSize, formatDuration, phaseToLabel } from '@/entrypoints/popup/utils/format';
import { Card } from '@/shared/ui/Card';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/icons/Icon';
import styles from './DownloadCard.module.css';

interface DownloadCardProps {
  download: DownloadItem;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DownloadCard({
  download,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
}: DownloadCardProps): React.JSX.Element {
  const isError = download.status === 'error';
  const isQueued = download.status === 'queued';
  const isDone = download.status === 'done';
  const isPaused = download.status === 'paused';
  const isDownloading = download.status === 'downloading';
  const isConverting = download.status === 'converting';
  const isActive = isDownloading || isConverting || isPaused;

  // Duration: calculate from timestamps if both available
  const durationMs =
    download.startedAt && download.completedAt
      ? download.completedAt - download.startedAt
      : undefined;

  // Determine if we should show two-phase layout (download done + converting)
  const showTwoPhase =
    isConverting &&
    download.downloadProgress !== undefined &&
    download.downloadProgress >= 100;

  // Phase text for converting status
  const phaseText = isConverting && download.conversionPhase
    ? ` · ${phaseToLabel(download.conversionPhase)}`
    : '';

  // Status text
  const statusText = isDone
    ? 'Done'
    : isError
      ? 'Error'
      : isPaused
        ? 'Paused'
        : download.status;

  // Action buttons based on status
  const actions: React.JSX.Element[] = [];
  if (isActive) {
    if (isPaused) {
      actions.push(
        <IconButton
          key="resume"
          size="xs"
          onClick={() => onResume(download.id)}
          aria-label="Resume"
          data-testid="resume-btn"
        >
          <Icon name="play" size={14} />
        </IconButton>,
      );
    } else {
      actions.push(
        <IconButton
          key="pause"
          size="xs"
          onClick={() => onPause(download.id)}
          aria-label="Pause"
          data-testid="pause-btn"
        >
          <Icon name="pause" size={14} />
        </IconButton>,
      );
    }
  }
  if (isError) {
    actions.push(
      <IconButton
        key="retry"
        size="xs"
        onClick={() => onRetry(download.id)}
        aria-label="Retry"
        data-testid="retry-btn"
      >
        <Icon name="rotateCcw" size={14} />
      </IconButton>,
    );
  }
  if (!isDone) {
    actions.push(
      <IconButton
        key="cancel"
        size="xs"
        variant="danger"
        onClick={() => onCancel(download.id)}
        aria-label="Cancel"
        data-testid="cancel-btn"
      >
        <Icon name="x" size={14} />
      </IconButton>,
    );
  } else {
    actions.push(
      <IconButton
        key="remove"
        size="xs"
        variant="danger"
        onClick={() => onRemove(download.id)}
        aria-label="Remove"
        data-testid="remove-btn"
      >
        <Icon name="trash" size={14} />
      </IconButton>,
    );
  }

  // Progress detail items
  const detailItems: React.JSX.Element[] = [];
  if (download.fileSize && download.fileSize > 0) {
    if (isDownloading || isPaused) {
      const processed = download.downloadedBytes ?? 0;
      detailItems.push(
        <span key="bytes" className={styles.detailItem}>
          <Icon name="download" size={12} />
          {formatFileSize(processed)}/{formatFileSize(download.fileSize)}
        </span>,
      );
    } else if (isConverting || isDone) {
      detailItems.push(
        <span key="size" className={styles.detailItem}>
          <Icon name="download" size={12} />
          {formatFileSize(download.fileSize)}
        </span>,
      );
    }
  }
  if (download.workerCount && download.workerCount > 0 && download.usedWorkers) {
    detailItems.push(
      <span key="workers" className={styles.detailItem}>
        <Icon name="zap" size={12} />
        {download.workerCount} workers
      </span>,
    );
  }
  if (isDone && durationMs) {
    detailItems.push(
      <span key="duration" className={styles.detailItem}>
        <Icon name="clock" size={12} />
        {formatDuration(durationMs)}
      </span>,
    );
  }

  // Build progress section
  let progressHtml: React.JSX.Element;
  if (isQueued) {
    progressHtml = (
      <div className={styles.queuedIndicator}>
        <Icon name="clock" size={14} />
        <span>Waiting…</span>
      </div>
    );
  } else if (showTwoPhase) {
    // Two-phase: Download (done) + Converting (in progress)
    progressHtml = (
      <>
        <div className={styles.phaseRow}>
          <span className={`${styles.phaseLabel} ${styles.done}`}>Download</span>
          <span className={`${styles.phasePercent} ${styles.done}`}>100%</span>
        </div>
        <div className={styles.progressBar}>
          <div className={`${styles.progressFill} ${styles.done}`} style={{ width: '100%' }} />
        </div>
        <div className={styles.phaseRow}>
          <span className={`${styles.phaseLabel} ${styles.active}`}>
            Converting{phaseText}
          </span>
          <span className={`${styles.phasePercent} ${styles.active}`}>{download.convertProgress ?? 0}%</span>
        </div>
        <div className={styles.progressBar}>
          <div className={`${styles.progressFill} ${styles.converting}`} style={{ width: `${download.convertProgress ?? 0}%` }} />
        </div>
      </>
    );
  } else if (isDone) {
    progressHtml = (
      <>
        <div className={styles.progressBar}>
          <div className={`${styles.progressFill} ${styles.done}`} style={{ width: '100%' }} role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100} />
        </div>
        <div className={styles.progressLabel}>
          <span>Done</span>
          <span className={styles.progressPercent}>100%</span>
        </div>
      </>
    );
  } else if (isError) {
    progressHtml = (
      <>
        <div className={styles.progressBar}>
          <div className={`${styles.progressFill} ${styles.error}`} style={{ width: `${download.progress}%` }} />
        </div>
        <div className={styles.progressLabel}>
          <span className={styles.errorText}>Failed at {download.progress}%</span>
          <span className={styles.progressPercent}>{download.progress}%</span>
        </div>
      </>
    );
  } else {
    // Single-phase: downloading or paused
    progressHtml = (
      <>
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${styles[download.status]}`}
            style={{ width: `${download.progress}%` }}
            role="progressbar"
            aria-valuenow={download.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className={styles.progressLabel}>
          <span>{statusText}</span>
          <span className={styles.progressPercent}>{download.progress}%</span>
        </div>
      </>
    );
  }

  return (
    <Card
      variant="default"
      className={`${styles.card} ${isError ? styles.error : ''} ${isQueued ? styles.queued : ''}`}
      data-testid="download-item"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{download.title}</span>
          {download.quality && (
            <span className={styles.qualityBadge}>{download.quality}</span>
          )}
          {download.usedWorkers && (
            <span className={styles.parallelBadge} title="Parallel conversion">
              <Icon name="zap" size={12} />
            </span>
          )}
        </div>
        <div className={styles.actions}>{actions}</div>
      </div>

      {/* Error message */}
      {isError && download.error && (
        <div className={styles.errorText}>{download.error}</div>
      )}

      {/* Progress section */}
      {progressHtml}

      {/* Detail items */}
      {detailItems.length > 0 && (
        <div className={styles.detailRow}>{detailItems}</div>
      )}
    </Card>
  );
}
