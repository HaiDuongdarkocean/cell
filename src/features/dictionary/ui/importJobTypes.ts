// importJobTypes — per-file import job model for ResourcesPanel.
//
// One dropped/picked file = one job row. Lifecycle:
//   queued → uploading → importing → success | error | skipped
//   uploading/importing → duplicate (parked prompt) → replace resumes / skip ends
// Status is UI-only — the SW keeps processing uploaded jobs even if the panel
// unmounts; rows are not restored on remount.

import type { DuplicateDecision, ResourceInfo, ResourceType } from '@/entities/dictionary';

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
  readonly resourceType: ResourceType;
  readonly signature: string;
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
