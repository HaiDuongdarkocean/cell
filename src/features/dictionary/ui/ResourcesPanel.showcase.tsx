import type { ReactElement } from 'react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { ImportProgress } from '@/features/dictionary/ui/ImportProgress';
import type { ImportJob } from '@/features/dictionary/ui/importJobTypes';
import type { ResourceInfo } from '@/entities/dictionary';
import styles from './ResourcesPanel.showcase.module.css';

const noop = (): void => {};

function job(fileName: string, overrides: Partial<ImportJob>): ImportJob {
  return {
    jobId: `demo-${fileName}`,
    file: new File(['x'], fileName),
    fileName,
    resourceType: 'DICTIONARY',
    signature: `sig-${fileName}`,
    forceReplace: false,
    status: 'queued',
    processed: 0,
    total: 0,
    uploadSent: 0,
    uploadTotal: 0,
    error: null,
    wordCount: null,
    resourceId: null,
    duplicate: null,
    ...overrides,
  };
}

const EXISTING: ResourceInfo = {
  id: 5,
  name: 'JMdict.zip',
  langCode: 'en',
  type: 'DICTIONARY',
  format: 'term-bank',
  signature: 'sig-old',
  wordCount: 180000,
  installationFinished: true,
  importedAt: Date.now(),
};

const STATE_ROWS: readonly ImportJob[] = [
  job('waiting.zip', { status: 'queued' }),
  job('uploading.zip', { status: 'uploading', uploadSent: 7, uploadTotal: 12 }),
  job('counting.zip', { status: 'importing', processed: 4200, total: 0 }),
  job('jmdict-entries.zip', { status: 'importing', processed: 35000, total: 73643 }),
  job('duplicate.zip', { status: 'duplicate', duplicate: { existing: EXISTING } }),
  job('done.zip', { status: 'success', wordCount: 73643 }),
  job('broken.zip', { status: 'error', error: 'Định dạng "broken.zip" không được hỗ trợ.' }),
  job('skipped.zip', { status: 'skipped' }),
];

export function Showcase(): ReactElement {
  return (
    <div className={styles.wrapper}>
      <div className={styles.panelFrame}>
        <ResourcesPanel langCode="en" />
      </div>
      <div className={styles.panelFrame}>
        {STATE_ROWS.map((j) => (
          <ImportProgress key={j.jobId} job={j} onResolveDuplicate={noop} onRerunReplace={noop} />
        ))}
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Dictionary Resources Panel',
  description: 'Dictionary + frequency resource management: per-file job rows (queued/uploading/importing/duplicate/success/error/skipped), dropzones, drag-reorder cards, delete confirm. Drop real files — the mock backend streams progress via JOB_EVENT.',
  level: 'organisms' as const,
  category: 'Dictionary',
  order: 30,
};
