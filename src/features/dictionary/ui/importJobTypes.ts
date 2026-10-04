// importJobTypes — per-file import job model for ResourcesPanel.
//
// One dropped/picked file = one job row. Lifecycle:
//   queued → uploading → importing → success | error | skipped
//   uploading/importing → duplicate (parked prompt) → replace resumes / skip ends
// Status is UI-only — the SW keeps processing uploaded jobs even if the panel
// unmounts; rows are not restored on remount.
//
// buildPendingImports merges local jobs + registry jobs with the unfinished
// resource rows the orchestrator created (installationFinished=false): a job
// whose resource row already exists renders as the card's own progress, so the
// row is suppressed — the same entry never appears twice.

import type { DictionaryComponent, DuplicateDecision, ResourceInfo } from '@/entities/dictionary';
import { isTerminalJob, type Job } from '@/entities/job/types';

export type ImportJobStatus =
  | 'queued'
  | 'uploading'
  | 'importing'
  | 'duplicate'
  | 'success'
  | 'error'
  | 'skipped';

/** A parked duplicate decision shown inline on the job row. */
export interface JobDuplicate {
  readonly existing: ResourceInfo;
  /** Resolves the in-flight onDuplicate promise. Absent for a result-shaped
   *  skip — the row then re-runs the file as 'replace'. */
  readonly resolve?: (choice: DuplicateDecision) => void;
}

export interface ImportJob {
  readonly jobId: string;
  readonly file: File;
  readonly fileName: string;
  readonly signature: string;
  /** Components detected from the file head — advisory; the strategy is the
   *  ground truth for what actually lands. */
  readonly detectedComponents: readonly DictionaryComponent[];
  /** User-adjusted subset (defaults to detectedComponents); read at handoff —
   *  chips stay live while the job is queued/uploading. */
  selectedComponents: readonly DictionaryComponent[];
  readonly forceReplace: boolean;
  status: ImportJobStatus;
  /** Entries processed so far (importing phase). */
  processed: number;
  /** Exact attempted-entry total; 0 = not yet known. */
  total: number;
  /** Base64 chunks acknowledged by the background (uploading phase). */
  uploadSent: number;
  uploadTotal: number;
  error: string | null;
  wordCount: number | null;
  resourceId: number | null;
  duplicate: JobDuplicate | null;
}

/** Statuses that occupy a scheduler slot. */
export const isRunningJob = (job: ImportJob): boolean =>
  job.status === 'uploading' || job.status === 'importing' || job.status === 'duplicate';

export const makeJobId = (): string =>
  `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface ResourceImportProgress {
  readonly phase: 'wait' | 'upload' | 'import';
  readonly done: number;
  readonly total: number;
}

export type PendingRow =
  | { readonly key: string; readonly ts: number; readonly local: ImportJob; readonly job?: undefined }
  | { readonly key: string; readonly ts: number; readonly local?: undefined; readonly job: Job };

export interface PendingImports {
  readonly rows: readonly PendingRow[];
  readonly progressByResourceId: ReadonlyMap<number, ResourceImportProgress>;
}

const LOCAL_PROGRESS_STATUSES: ReadonlySet<ImportJobStatus> = new Set(['queued', 'uploading', 'importing']);

const impTs = (id: string): number | null => {
  const match = /^imp-([0-9a-z]+)-/i.exec(id);
  return match ? Number.parseInt(match[1], 36) : null;
};

const toProgress = (source: Job | ImportJob): ResourceImportProgress => {
  if ('fileName' in source) {
    if (source.status === 'uploading') {
      return { phase: 'upload', done: source.uploadSent, total: source.uploadTotal };
    }
    if (source.status === 'importing') {
      return { phase: 'import', done: source.processed, total: source.total };
    }
    return { phase: 'wait', done: 0, total: 0 };
  }
  if (source.status === 'queued') return { phase: 'wait', done: 0, total: 0 };
  if (source.status === 'uploading') {
    return { phase: 'upload', done: source.progress.done, total: source.progress.total };
  }
  return { phase: 'import', done: source.progress.done, total: source.progress.total };
};

const signatureOf = (job: Job): string | null =>
  typeof job.params.signature === 'string' ? job.params.signature : null;

export const buildPendingImports = (
  resources: readonly ResourceInfo[],
  jobs: readonly ImportJob[],
  registryJobs: readonly Job[],
): PendingImports => {
  const progressByResourceId = new Map<number, ResourceImportProgress>();
  const coveredRegistry = new Set<string>();
  const coveredLocal = new Set<string>();

  for (const resource of resources) {
    if (resource.installationFinished !== false || resource.id == null) continue;
    const registry = registryJobs.find(
      (j) => j.kind === 'resource-import' && !isTerminalJob(j)
        && (j.resourceId === resource.id || signatureOf(j) === resource.signature),
    );
    const local = registry
      ? undefined
      : jobs.find(
          (j) => j.signature !== '' && j.signature === resource.signature
            && LOCAL_PROGRESS_STATUSES.has(j.status),
        );
    const source = registry ?? local;
    if (source == null) continue;
    progressByResourceId.set(resource.id, toProgress(source));
    if (registry) coveredRegistry.add(registry.id);
    else if (local) coveredLocal.add(local.jobId);
  }

  const rows = new Map<string, PendingRow>();
  for (const job of jobs) {
    if (coveredLocal.has(job.jobId)) continue;
    rows.set(job.jobId, { key: job.jobId, ts: impTs(job.jobId) ?? 0, local: job });
  }
  for (const job of registryJobs) {
    if (rows.has(job.id) || coveredRegistry.has(job.id)) continue;
    if (job.kind === 'resource-import' && job.status === 'done') {
      const rid = job.resourceId ?? job.result?.resourceId;
      const landed = rid != null
        ? resources.some((r) => r.id === rid)
        : signatureOf(job) != null && resources.some((r) => r.signature === signatureOf(job));
      if (landed) continue;
    }
    rows.set(job.id, { key: job.id, ts: impTs(job.id) ?? job.createdAt, job });
  }

  return {
    rows: [...rows.values()].sort((a, b) => b.ts - a.ts),
    progressByResourceId,
  };
};
