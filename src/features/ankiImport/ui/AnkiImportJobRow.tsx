import { Button, IconButton, Spinner, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import type { ImportReport } from '../logic/importWriter';
import styles from './AnkiImportJobRow.module.css';

export interface AnkiImportJob {
  readonly status: 'running' | 'done' | 'error' | 'cancelled';
  readonly done: number;
  readonly total: number;
  readonly title: string;
  readonly report?: ImportReport;
  readonly error?: string;
}

interface AnkiImportJobRowProps {
  readonly job: AnkiImportJob;
  readonly fidelity: 'full' | 'estimated' | null;
  readonly onCancel: () => void;
  readonly onDismiss: () => void;
  readonly onStudyNow: () => void;
  readonly onRetry: () => void;
}

function doneMeta(report: ImportReport, fidelity: 'full' | 'estimated' | null): string {
  const base = t('ankiImport.job.doneMeta', [
    report.importedCards, report.mediaHits, report.reviewRecords,
  ]);
  const failed = report.failedCards > 0 ? ` · ${t('ankiImport.job.errors', [report.failedCards])}` : '';
  const est = fidelity === 'estimated' ? ` · ${t('ankiImport.job.fidelityEstimated')}` : '';
  return `${base}${failed}${est}`;
}

export function AnkiImportJobRow({ job, fidelity, onCancel, onDismiss, onStudyNow, onRetry }: AnkiImportJobRowProps): React.JSX.Element {
  const pct = job.total > 0 ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
  const cls = [
    styles.job,
    job.status === 'running' ? styles.jobRunning : '',
    job.status === 'error' ? styles.jobError : '',
    job.status === 'cancelled' ? styles.jobCancelled : '',
  ].filter(Boolean).join(' ');

  let meta: React.ReactNode = null;
  let right: React.ReactNode = null;

  switch (job.status) {
    case 'running':
      meta = <span className={styles.metaMuted}>{t('ankiImport.job.importing', [job.done.toLocaleString(), job.total.toLocaleString()])}</span>;
      right = (
        <>
          <span className={styles.pct}>{pct}%</span>
          <IconButton size="sm" variant="ghost" aria-label={t('srs.edit.cancel')} onClick={onCancel}>
            <Icon name="x" />
          </IconButton>
        </>
      );
      break;
    case 'done':
      meta = (
        <>
          <span className={styles.metaOk}>{job.report ? doneMeta(job.report, fidelity) : ''}</span>
          <Button variant="primary" size="xs" onClick={onStudyNow} data-cell-id="import-job-study">
            {t('ankiImport.action.studyNow')}
          </Button>
        </>
      );
      right = (
        <>
          <Icon name="circleCheck" size="sm" className={styles.iconOk} />
          <IconButton size="sm" variant="ghost" aria-label={t('jobs.action.dismiss')} onClick={onDismiss}>
            <Icon name="x" />
          </IconButton>
        </>
      );
      break;
    case 'error':
      meta = (
        <>
          <span className={styles.metaErr}>{job.error ?? t('ankiImport.job.failed')}</span>
          <Button variant="outline" size="xs" onClick={onRetry} data-cell-id="import-job-retry">
            {t('ankiImport.job.retry')}
          </Button>
        </>
      );
      right = (
        <>
          <Icon name="alertCircle" size="sm" className={styles.iconErr} />
          <IconButton size="sm" variant="ghost" aria-label={t('jobs.action.dismiss')} onClick={onDismiss}>
            <Icon name="x" />
          </IconButton>
        </>
      );
      break;
    case 'cancelled':
      meta = <span className={styles.metaDup}>{t('ankiImport.job.cancelled')}</span>;
      right = (
        <>
          <Icon name="triangleAlert" size="sm" className={styles.iconDup} />
          <IconButton size="sm" variant="ghost" aria-label={t('jobs.action.dismiss')} onClick={onDismiss}>
            <Icon name="x" />
          </IconButton>
        </>
      );
      break;
  }

  return (
    <div className={cls} role="status" aria-live="polite" data-cell-id="anki-import-job">
      {job.status === 'running' && job.total > 0 && (
        <span className={styles.fill} style={{ transform: `scaleY(${pct / 100})` }} aria-hidden="true" />
      )}
      <div className={styles.row}>
        {job.status === 'running' ? (
          <Spinner size="sm" ariaLabel={t('ankiImport.job.importing', [job.done, job.total])} />
        ) : (
          <span className={styles.deckIcon}><Icon name="import" /></span>
        )}
        <div className={styles.info}>
          <Text variant="label" className={styles.name}>{job.title}</Text>
          <span className={styles.metaRow}>{meta}</span>
        </div>
        <span className={styles.right}>{right}</span>
      </div>
    </div>
  );
}
