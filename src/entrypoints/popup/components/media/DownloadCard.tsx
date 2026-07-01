import type { DownloadItem } from '@/entities/media';
import { formatFileSize, formatDuration, phaseToLabel } from '@/entrypoints/popup/utils/format';
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
        <button
          key="resume"
          className={styles.actionBtn}
          onClick={() => onResume(download.id)}
          aria-label="Resume"
          data-testid="resume-btn"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z" /></svg>
        </button>,
      );
    } else {
      actions.push(
        <button
          key="pause"
          className={styles.actionBtn}
          onClick={() => onPause(download.id)}
          aria-label="Pause"
          data-testid="pause-btn"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
        </button>,
      );
    }
  }
  if (isError) {
    actions.push(
      <button
        key="retry"
        className={styles.actionBtn}
        onClick={() => onRetry(download.id)}
        aria-label="Retry"
        data-testid="retry-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
      </button>,
    );
  }
  if (!isDone) {
    actions.push(
      <button
        key="cancel"
        className={`${styles.actionBtn} ${styles.danger}`}
        onClick={() => onCancel(download.id)}
        aria-label="Cancel"
        data-testid="cancel-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>,
    );
  } else {
    actions.push(
      <button
        key="remove"
        className={`${styles.actionBtn} ${styles.danger}`}
        onClick={() => onRemove(download.id)}
        aria-label="Remove"
        data-testid="remove-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
      </button>,
    );
  }

  // Progress detail items
  const detailItems: React.JSX.Element[] = [];
  if (download.fileSize && download.fileSize > 0) {
    if (isDownloading || isPaused) {
      const processed = download.downloadedBytes ?? 0;
      detailItems.push(
        <span key="bytes" className={styles.detailItem}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          {formatFileSize(processed)}/{formatFileSize(download.fileSize)}
        </span>,
      );
    } else if (isConverting || isDone) {
      detailItems.push(
        <span key="size" className={styles.detailItem}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          {formatFileSize(download.fileSize)}
        </span>,
      );
    }
  }
  if (download.workerCount && download.workerCount > 0 && download.usedWorkers) {
    detailItems.push(
      <span key="workers" className={styles.detailItem}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        {download.workerCount} workers
      </span>,
    );
  }
  if (isDone && durationMs) {
    detailItems.push(
      <span key="duration" className={styles.detailItem}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        {formatDuration(durationMs)}
      </span>,
    );
  }

  // Build progress section
  let progressHtml: React.JSX.Element;
  if (isQueued) {
    progressHtml = (
      <div className={styles.queuedIndicator}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
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
    <div
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
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
    </div>
  );
}
