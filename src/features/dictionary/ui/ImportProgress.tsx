// ImportProgress — one job row per dropped file (water-fill concept).
//
// The card IS the queue: a placeholder row appears in the resource list the
// moment a file is dropped. A primary-subtle fill rises through the card as
// entries stream in; the right edge shows spinner → % → terminal icon.
// Statuses: queued | uploading | importing | duplicate | success | error | skipped.

import { type ReactElement } from 'react';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import type { ImportJob } from './importJobTypes';
import styles from './ImportProgress.module.css';

interface ImportProgressProps {
  readonly job: ImportJob;
  readonly onResolveDuplicate: (jobId: string, choice: 'replace' | 'skip') => void;
  readonly onRerunReplace: (jobId: string) => void;
}

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

export function ImportProgress({ job, onResolveDuplicate, onRerunReplace }: ImportProgressProps): ReactElement {
  const isUpload = job.status === 'uploading';
  const isImport = job.status === 'importing';
  const fillPct = isUpload
    ? percent(job.uploadSent, job.uploadTotal)
    : percent(job.processed, job.total);

  const cls = [
    styles.job,
    job.status === 'queued' ? styles.jobQueued : '',
    job.status === 'error' ? styles.jobError : '',
    job.status === 'duplicate' || job.status === 'skipped' ? styles.jobDup : '',
  ].filter(Boolean).join(' ');

  let meta: React.ReactNode = null;
  let right: React.ReactNode = null;

  switch (job.status) {
    case 'queued':
      meta = <span className={styles.metaMuted}>Chờ lượt</span>;
      right = <Spinner size="sm" ariaLabel="Chờ lượt" />;
      break;
    case 'uploading':
      meta = <span className={styles.metaMuted}>Đang tải lên… {fillPct}%</span>;
      right = <span className={styles.pct}>{fillPct}%</span>;
      break;
    case 'importing':
      meta = (
        <span className={styles.metaMuted}>
          Đang thêm… {job.processed.toLocaleString('vi-VN')}
          {job.total > 0 ? ` / ${job.total.toLocaleString('vi-VN')}` : ''} mục
        </span>
      );
      right = job.total > 0
        ? <span className={styles.pct}>{fillPct}%</span>
        : <Spinner size="sm" ariaLabel="Đang đếm" />;
      break;
    case 'duplicate': {
      const existing = job.duplicate?.existing;
      const replaceBlocked = existing?.installationFinished === false;
      meta = (
        <span className={styles.metaDup}>
          Đã có sẵn &quot;{existing?.name}&quot;
          {replaceBlocked && ' — đang được thêm, chỉ có thể bỏ qua'}
          <span className={styles.dupActions}>
            <Button
              variant="outline"
              size="xs"
              disabled={replaceBlocked}
              onClick={() => onResolveDuplicate(job.jobId, 'replace')}
              data-cell-id={`dup-replace-${job.jobId}`}
            >
              Thay thế
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onResolveDuplicate(job.jobId, 'skip')}
              data-cell-id={`dup-skip-${job.jobId}`}
            >
              Bỏ qua
            </Button>
          </span>
        </span>
      );
      right = <Icon name="triangleAlert" size="sm" className={styles.iconDup} />;
      break;
    }
    case 'success':
      meta = <span className={styles.metaOk}>Đã thêm {job.wordCount?.toLocaleString('vi-VN')} từ</span>;
      right = <Icon name="circleCheck" size="sm" className={styles.iconOk} />;
      break;
    case 'error':
      meta = <span className={styles.metaErr}>{job.error}</span>;
      right = <Icon name="alertCircle" size="sm" className={styles.iconErr} />;
      break;
    case 'skipped':
      meta = (
        <span className={styles.metaDup}>
          Đã bỏ qua — file đã tồn tại
          <span className={styles.dupActions}>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onRerunReplace(job.jobId)}
              data-cell-id={`skipped-replace-${job.jobId}`}
            >
              Thay thế
            </Button>
          </span>
        </span>
      );
      right = <Icon name="triangleAlert" size="sm" className={styles.iconDup} />;
      break;
  }

  return (
    <div className={cls} data-cell-id={`import-job-${job.jobId}`} role="listitem">
      {(isUpload || (isImport && job.total > 0)) && (
        <span
          className={styles.fill}
          style={{ height: `${fillPct}%` }}
          aria-hidden="true"
        />
      )}
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.name}>{job.file.name}</span>
          {meta}
        </div>
        <span className={styles.right}>{right}</span>
      </div>
    </div>
  );
}
