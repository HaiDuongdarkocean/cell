// ImportProgress — one job row per dropped file.
//
// Skeleton: [leading status icon] [name · meta ............ % | buttons]
//                                  [progress bar — running states only]
// Statuses: queued | uploading | importing | duplicate | success | error.

import { type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { Button, Progress } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import type { DictionaryComponent } from '@/entities/dictionary';
import type { ImportJob } from './importJobTypes';
import styles from './ImportProgress.module.css';

interface ImportProgressProps {
  readonly job: ImportJob;
  /** The file's resource is still being removed — the job stays queued until
   *  the delete finishes, then uploads on its own. */
  readonly waitingRemoval?: boolean;
  readonly onToggleComponent?: (jobId: string, component: DictionaryComponent) => void;
  readonly onResolveDuplicate: (jobId: string, choice: 'replace' | 'skip') => void;
  readonly onRetry?: (jobId: string) => void;
  readonly onDismiss?: (jobId: string) => void;
}

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

export function ImportProgress({ job, waitingRemoval, onResolveDuplicate, onRetry, onDismiss }: ImportProgressProps): ReactElement {
  const isUpload = job.status === 'uploading';
  const isImport = job.status === 'importing';
  const fillPct = isUpload
    ? percent(job.uploadSent, job.uploadTotal)
    : percent(job.processed, job.total);
  const running = job.status === 'queued' || isUpload || isImport;
  const indeterminate = (isUpload && job.uploadTotal === 0) || (isImport && job.total === 0);

  const cls = [
    styles.job,
    job.status === 'queued' ? styles.jobQueued : '',
    job.status === 'error' ? styles.jobError : '',
    job.status === 'duplicate' ? styles.jobDup : '',
  ].filter(Boolean).join(' ');

  let meta: React.ReactNode = null;
  let right: React.ReactNode = null;
  let leading: React.ReactNode = null;

  switch (job.status) {
    case 'queued':
      meta = <span className={styles.metaMuted}>{t(waitingRemoval === true ? 'resources.job.waitingRemoval' : 'resources.job.waiting')}</span>;
      leading = <Spinner size="lg" ariaLabel={t(waitingRemoval === true ? 'resources.job.waitingRemoval' : 'resources.job.waiting')} />;
      right = <span className={styles.pct}>0%</span>;
      break;
    case 'uploading':
      meta = job.uploadTotal === 0
        ? <span className={styles.metaMuted}>{t('resources.job.preparing')}</span>
        : <span className={styles.metaMuted}>{t('resources.job.uploadingState')}</span>;
      leading = <Spinner size="lg" ariaLabel={t('resources.job.uploadingState')} />;
      if (job.uploadTotal > 0) right = <span className={styles.pct}>{fillPct}%</span>;
      break;
    case 'importing':
      meta = <span className={styles.metaMuted}>{t('resources.job.addingState')}</span>;
      leading = <Spinner size="lg" ariaLabel={t(job.total > 0 ? 'resources.job.addingState' : 'resources.job.counting')} />;
      if (job.total > 0) right = <span className={styles.pct}>{fillPct}%</span>;
      break;
    case 'duplicate': {
      const existing = job.duplicate?.existing;
      const replaceBlocked = existing?.installationFinished === false;
      meta = (
        <span className={styles.metaDup}>
          {t('resources.job.exists', [existing?.name ?? ''])}
          {replaceBlocked && t('resources.job.existsBlocked')}
        </span>
      );
      leading = <Icon name="triangleAlert" size="md" className={styles.iconDup} />;
      right = (
        <>
          <Button
            variant="secondary"
            size="sm"
            className={styles.action}
            disabled={replaceBlocked}
            onClick={() => onResolveDuplicate(job.jobId, 'replace')}
            data-tihoka-id={`dup-replace-${job.jobId}`}
          >
            {t('resources.job.replace')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={styles.action}
            onClick={() => onResolveDuplicate(job.jobId, 'skip')}
            data-tihoka-id={`dup-skip-${job.jobId}`}
          >
            {t('resources.job.skip')}
          </Button>
        </>
      );
      break;
    }
    case 'success':
      meta = <span className={styles.metaOk}>{t('resources.job.added', [job.wordCount?.toLocaleString() ?? ''])}</span>;
      leading = <Icon name="circleCheck" size="md" className={styles.iconOk} />;
      break;
    case 'error':
      meta = <span className={styles.metaErr}>{job.error}</span>;
      leading = <Icon name="alertCircle" size="md" className={styles.iconErr} />;
      right = (
        <>
          {onRetry !== undefined && (
            <Button
              variant="secondary"
              size="sm"
              className={styles.action}
              onClick={() => onRetry(job.jobId)}
              data-tihoka-id={`job-retry-${job.jobId}`}
            >
              {t('jobs.action.retry')}
            </Button>
          )}
          {onDismiss !== undefined && (
            <Button
              variant="secondary"
              size="sm"
              className={styles.action}
              onClick={() => onDismiss(job.jobId)}
              data-tihoka-id={`job-dismiss-${job.jobId}`}
            >
              {t('jobs.action.dismiss')}
            </Button>
          )}
        </>
      );
      break;
  }

  return (
    <div className={cls} data-tihoka-id={`import-job-${job.jobId}`} role="listitem" aria-live="polite">
      {leading !== null && <span className={styles.leading}>{leading}</span>}
      <div className={styles.body}>
        <div className={styles.info}>
          <span className={styles.name}>{job.fileName}</span>
          {meta !== null && <><span className={styles.metaSep} aria-hidden="true">·</span>{meta}</>}
          {right !== null && <span className={styles.right}>{right}</span>}
        </div>
        {running && (
          <Progress
            size="sm"
            value={fillPct}
            indeterminate={indeterminate || undefined}
            className={styles.progress}
            aria-label={job.fileName}
          />
        )}
      </div>
    </div>
  );
}
