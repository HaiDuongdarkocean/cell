// ImportProgress — one job row per dropped file (water-fill concept).
//
// The card IS the queue: a placeholder row appears in the resource list the
// moment a file is dropped. A primary-subtle fill rises through the card as
// entries stream in; the right edge shows spinner → % → terminal icon.
// Statuses: queued | uploading | importing | duplicate | success | error | skipped.

import { type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { Button, Chip } from '@/shared/ui';
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
  readonly onRerunReplace: (jobId: string) => void;
  readonly onRetry?: (jobId: string) => void;
  readonly onDismiss?: (jobId: string) => void;
}

const kindLabel = (c: DictionaryComponent): string =>
  t(c === 'frequency' ? 'resources.job.kind.frequency' : 'resources.job.kind.dictionary');

const PICKER_LIVE: ReadonlySet<ImportJob['status']> = new Set(['queued', 'uploading']);

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

export function ImportProgress({ job, waitingRemoval, onToggleComponent, onResolveDuplicate, onRerunReplace, onRetry, onDismiss }: ImportProgressProps): ReactElement {
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
      meta = <span className={styles.metaMuted}>{t(waitingRemoval === true ? 'resources.job.waitingRemoval' : 'resources.job.waiting')}</span>;
      right = <Spinner size="sm" ariaLabel={t(waitingRemoval === true ? 'resources.job.waitingRemoval' : 'resources.job.waiting')} />;
      break;
    case 'uploading':
      if (job.uploadTotal === 0) {
        meta = <span className={styles.metaMuted}>{t('resources.job.preparing')}</span>;
        right = <Spinner size="sm" ariaLabel={t('resources.job.preparing')} />;
      } else {
        meta = <span className={styles.metaMuted}>{t('resources.job.uploading', [fillPct])}</span>;
        right = <span className={styles.pct}>{fillPct}%</span>;
      }
      break;
    case 'importing':
      meta = (
        <span className={styles.metaMuted}>
          {job.total > 0
            ? t('resources.job.importingOf', [job.processed.toLocaleString(), job.total.toLocaleString()])
            : t('resources.job.importing', [job.processed.toLocaleString()])}
        </span>
      );
      right = job.total > 0
        ? <span className={styles.pct}>{fillPct}%</span>
        : <Spinner size="sm" ariaLabel={t('resources.job.counting')} />;
      break;
    case 'duplicate': {
      const existing = job.duplicate?.existing;
      const replaceBlocked = existing?.installationFinished === false;
      meta = (
        <span className={styles.metaDup}>
          {t('resources.job.exists', [existing?.name ?? ''])}
          {replaceBlocked && t('resources.job.existsBlocked')}
          <span className={styles.dupActions}>
            <Button
              variant="outline"
              size="xs"
              disabled={replaceBlocked}
              onClick={() => onResolveDuplicate(job.jobId, 'replace')}
              data-cell-id={`dup-replace-${job.jobId}`}
            >
              {t('resources.job.replace')}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onResolveDuplicate(job.jobId, 'skip')}
              data-cell-id={`dup-skip-${job.jobId}`}
            >
              {t('resources.job.skip')}
            </Button>
          </span>
        </span>
      );
      right = <Icon name="triangleAlert" size="sm" className={styles.iconDup} />;
      break;
    }
    case 'success':
      meta = <span className={styles.metaOk}>{t('resources.job.added', [job.wordCount?.toLocaleString() ?? ''])}</span>;
      right = <Icon name="circleCheck" size="sm" className={styles.iconOk} />;
      break;
    case 'error':
      meta = (
        <span className={styles.metaErr}>
          {job.error}
          <span className={styles.dupActions}>
            {onRetry !== undefined && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onRetry(job.jobId)}
                data-cell-id={`job-retry-${job.jobId}`}
              >
                {t('jobs.action.retry')}
              </Button>
            )}
            {onDismiss !== undefined && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onDismiss(job.jobId)}
                data-cell-id={`job-dismiss-${job.jobId}`}
              >
                {t('jobs.action.dismiss')}
              </Button>
            )}
          </span>
        </span>
      );
      right = <Icon name="alertCircle" size="sm" className={styles.iconErr} />;
      break;
    case 'skipped':
      meta = (
        <span className={styles.metaDup}>
          {t('resources.job.skipped')}
          <span className={styles.dupActions}>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onRerunReplace(job.jobId)}
              data-cell-id={`skipped-replace-${job.jobId}`}
            >
              {t('resources.job.replace')}
            </Button>
            {onDismiss !== undefined && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onDismiss(job.jobId)}
                data-cell-id={`job-dismiss-${job.jobId}`}
              >
                {t('jobs.action.dismiss')}
              </Button>
            )}
          </span>
        </span>
      );
      right = <Icon name="triangleAlert" size="sm" className={styles.iconDup} />;
      break;
  }

  return (
    <div className={cls} data-cell-id={`import-job-${job.jobId}`} role="listitem" aria-live="polite">
      {(isUpload || (isImport && job.total > 0)) && (
        <span
          className={styles.fill}
          style={{ height: `${fillPct}%` }}
          aria-hidden="true"
        />
      )}
      <div className={styles.row}>
        <div className={styles.info}>
          <span className={styles.name}>{job.fileName}</span>
          {job.detectedComponents.length > 0 && (
            <span className={styles.kindChips}>
              {job.detectedComponents.map((c) => {
                const label = kindLabel(c);
                const pickable = job.detectedComponents.length > 1
                  && PICKER_LIVE.has(job.status)
                  && onToggleComponent !== undefined;
                const lastSelected = job.selectedComponents.length === 1
                  && job.selectedComponents[0] === c;
                return pickable ? (
                  <Chip
                    key={c}
                    as="button"
                    size="sm"
                    variant="outline"
                    selected={job.selectedComponents.includes(c)}
                    disabled={lastSelected}
                    title={lastSelected ? t('resources.job.componentRequired') : undefined}
                    onClick={() => onToggleComponent(job.jobId, c)}
                    aria-label={t('resources.job.componentToggle', [label])}
                    data-cell-id={`job-component-${c}-${job.jobId}`}
                  >
                    {label}
                  </Chip>
                ) : job.selectedComponents.includes(c) ? (
                  <Chip key={c} size="sm" variant="outline">{label}</Chip>
                ) : null;
              })}
            </span>
          )}
          {meta}
        </div>
        <span className={styles.right}>{right}</span>
      </div>
    </div>
  );
}
