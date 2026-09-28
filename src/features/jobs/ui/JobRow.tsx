/**
 * JobRow — one registry-owned job row inside its Settings section.
 *
 * Pure view over a Job record: the registry is the source of truth, so the
 * row renders identically whether the job started in this surface or
 * elsewhere, and terminal rows persist until dismissed.
 */
import type { ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { Card } from '@/shared/ui/Card';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { Progress } from '@/shared/ui/Progress';
import { Spinner } from '@/shared/ui/Spinner';
import { formatBytes } from '@/shared/lib/formatBytes';
import { isActiveJob, type Job, type JobStatus } from '@/entities/job/types';
import { jobErrorText } from '../jobErrorText';
import type { MessageKey } from '@/shared/i18n';
import styles from './JobRow.module.css';

const STATUS_KEYS: Record<JobStatus, MessageKey> = {
  queued: 'jobs.status.queued',
  uploading: 'jobs.status.uploading',
  running: 'jobs.status.running',
  done: 'jobs.status.done',
  failed: 'jobs.status.failed',
  interrupted: 'jobs.status.interrupted',
};

interface JobRowProps {
  readonly job: Job;
  readonly onDismiss?: (jobId: string) => void;
  readonly onRetry?: (jobId: string) => void;
}

function statusIcon(job: Job): ReactElement {
  if (isActiveJob(job)) {
    return <Spinner size="sm" ariaLabel={t(STATUS_KEYS[job.status])} />;
  }
  if (job.status === 'done') {
    return <Icon name="circleCheck" size="sm" className={styles.iconOk} />;
  }
  return <Icon name="info" size="sm" className={styles.iconWarn} />;
}

function metaText(job: Job): string {
  const { done, total, unit } = job.progress;
  const statusText = t(STATUS_KEYS[job.status]);
  if (job.status === 'done') {
    const count = job.result?.wordCount ?? job.result?.count;
    if (typeof count === 'number') {
      return t('jobs.meta.detail', [statusText, count.toLocaleString()]);
    }
    return statusText;
  }
  if (isActiveJob(job) && total > 0) {
    const amount = unit === 'bytes'
      ? `${formatBytes(done)} / ${formatBytes(total)}`
      : `${done.toLocaleString()} / ${total.toLocaleString()}`;
    return t('jobs.meta.detail', [statusText, amount]);
  }
  if (isActiveJob(job) && done > 0) {
    return t('jobs.meta.detail', [statusText, done.toLocaleString()]);
  }
  return statusText;
}

export function JobRow({ job, onDismiss, onRetry }: JobRowProps): ReactElement {
  const active = isActiveJob(job);
  const failed = job.status === 'failed';
  const interrupted = job.status === 'interrupted';
  const reimportHint = interrupted && job.kind === 'resource-import';
  const canRetry = !active && job.retryable && onRetry !== undefined;

  const cls = [
    styles.job,
    failed ? styles.jobError : '',
    interrupted ? styles.jobInterrupted : '',
  ].filter(Boolean).join(' ');

  return (
    <Card className={cls} aria-live="polite" role="listitem" data-cell-id={`job-row-${job.id}`}>
      <div className={styles.row}>
        <span className={styles.lead}>{statusIcon(job)}</span>
        <div className={styles.info}>
          <Text variant="body" truncate className={styles.name}>{job.label}</Text>
          <Text as="p" variant="supporting" color="secondary" className={styles.meta}>
            {metaText(job)}
          </Text>
          {(failed || interrupted) && job.error !== undefined && (
            <Text as="p" variant="supporting" className={styles.errorText}>{jobErrorText(job.error)}</Text>
          )}
          {reimportHint && (
            <Text as="p" variant="supporting" color="secondary">{t('jobs.interrupted.reimport')}</Text>
          )}
          {active && job.progress.total > 0 && (
            <Progress
              value={job.progress.done}
              max={job.progress.total}
              size="sm"
              className={styles.progress}
            />
          )}
        </div>
        <span className={styles.actions}>
          {canRetry && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('jobs.action.retry')}
              title={t('jobs.action.retry')}
              onClick={() => onRetry(job.id)}
              data-cell-id={`job-retry-${job.id}`}
            >
              <Icon name="rotateCcw" size="sm" />
            </Button>
          )}
          {!active && onDismiss !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('jobs.action.dismiss')}
              title={t('jobs.action.dismiss')}
              onClick={() => onDismiss(job.id)}
              data-cell-id={`job-dismiss-${job.id}`}
            >
              <Icon name="x" size="sm" />
            </Button>
          )}
        </span>
      </div>
    </Card>
  );
}
