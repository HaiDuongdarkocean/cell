import type { DownloadItem } from '@/entities/media';
import { formatFileSize, formatDuration, phaseToLabel } from '@/entrypoints/popup/utils/format';
import { Card } from '@/shared/ui/Card';
import { Flex } from '@/shared/ui/Flex';
import { HStack, VStack } from '@/shared/ui/Stack';
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
          data-cell-id="resume-btn"
        >
          <Icon name="play" size={24} />
        </IconButton>,
      );
    } else {
      actions.push(
        <IconButton
          key="pause"
          size="xs"
          onClick={() => onPause(download.id)}
          aria-label="Pause"
          data-cell-id="pause-btn"
        >
          <Icon name="pause" size={24} />
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
        data-cell-id="retry-btn"
      >
        <Icon name="rotateCcw" size={24} />
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
        data-cell-id="cancel-btn"
      >
        <Icon name="x" size={24} />
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
        data-cell-id="remove-btn"
      >
        <Icon name="trash" size={24} />
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
          <Icon name="download" size={24} />
          {formatFileSize(processed)}/{formatFileSize(download.fileSize)}
        </span>,
      );
    } else if (isConverting || isDone) {
      detailItems.push(
        <span key="size" className={styles.detailItem}>
          <Icon name="download" size={24} />
          {formatFileSize(download.fileSize)}
        </span>,
      );
    }
  }
  if (download.workerCount && download.workerCount > 0 && download.usedWorkers) {
    detailItems.push(
      <span key="workers" className={styles.detailItem}>
        <Icon name="zap" size={24} />
        {download.workerCount} workers
      </span>,
    );
  }
  if (isDone && durationMs) {
    detailItems.push(
      <span key="duration" className={styles.detailItem}>
        <Icon name="clock" size={24} />
        {formatDuration(durationMs)}
      </span>,
    );
  }

  // Build progress section
  let progressHtml: React.JSX.Element;
  if (isQueued) {
    progressHtml = (
      <HStack align="center" gap="1-5" className={styles.queuedIndicator}>
        <Icon name="clock" size={24} />
        <span>Waiting…</span>
      </HStack>
    );
  } else if (showTwoPhase) {
    // Two-phase: Download (done) + Converting (in progress)
    progressHtml = (
      <>
        <HStack align="center" justify="between" gap="0" className={styles.phaseRow}>
          <span className={`${styles.phaseLabel} ${styles.done}`}>Download</span>
          <span className={`${styles.phasePercent} ${styles.done}`}>100%</span>
        </HStack>
        <div className={styles.progressBar}>
          <div className={`${styles.progressFill} ${styles.done}`} style={{ width: '100%' }} />
        </div>
        <HStack align="center" justify="between" gap="0" className={styles.phaseRow}>
          <span className={`${styles.phaseLabel} ${styles.active}`}>
            Converting{phaseText}
          </span>
          <span className={`${styles.phasePercent} ${styles.active}`}>{download.convertProgress ?? 0}%</span>
        </HStack>
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
        <HStack align="center" justify="between" gap="0" className={styles.progressLabel}>
          <span>Done</span>
          <span className={styles.progressPercent}>100%</span>
        </HStack>
      </>
    );
  } else if (isError) {
    progressHtml = (
      <>
        <div className={styles.progressBar}>
          <div className={`${styles.progressFill} ${styles.error}`} style={{ width: `${download.progress}%` }} />
        </div>
        <HStack align="center" justify="between" gap="0" className={styles.progressLabel}>
          <span className={styles.errorText}>Failed at {download.progress}%</span>
          <span className={styles.progressPercent}>{download.progress}%</span>
        </HStack>
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
        <HStack align="center" justify="between" gap="0" className={styles.progressLabel}>
          <span>{statusText}</span>
          <span className={styles.progressPercent}>{download.progress}%</span>
        </HStack>
      </>
    );
  }

  return (
    <Card
      variant="default"
      className={`${styles.card} ${isError ? styles.error : ''} ${isQueued ? styles.queued : ''}`}
      data-cell-id="download-item"
    >
      <VStack gap="2">
        {/* Header */}
        <HStack align="center" justify="between" gap="2" className={styles.header}>
          <HStack align="center" gap="1-5" className={styles.titleRow}>
            <span className={styles.title}>{download.title}</span>
            {download.quality && (
              <span className={styles.qualityBadge}>{download.quality}</span>
            )}
            {download.usedWorkers && (
              <span className={styles.parallelBadge} title="Parallel conversion">
                <Icon name="zap" size={24} />
              </span>
            )}
          </HStack>
          <HStack align="center" gap="1" className={styles.actions}>
            {actions}
          </HStack>
        </HStack>

        {/* Error message */}
        {isError && download.error && (
          <div className={styles.errorText}>{download.error}</div>
        )}

        {/* Progress section */}
        {progressHtml}

        {/* Detail items */}
        {detailItems.length > 0 && (
          <Flex align="center" gap="2" wrap="wrap" className={styles.detailRow}>
            {detailItems}
          </Flex>
        )}
      </VStack>
    </Card>
  );
}
