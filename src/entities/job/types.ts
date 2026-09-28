export type JobKind =
  | 'resource-import'
  | 'resource-delete'
  | 'voice-download'
  | 'local-audio-index';

export type JobStatus =
  | 'queued'
  | 'uploading'
  | 'running'
  | 'done'
  | 'failed'
  | 'interrupted';

export const JOB_ACTIVE_STATUSES: readonly JobStatus[] = ['queued', 'uploading', 'running'];
export const JOB_TERMINAL_STATUSES: readonly JobStatus[] = ['done', 'failed', 'interrupted'];

export const JOB_ERROR_INTERRUPTED_RESTART = 'interrupted-restart';
export const JOB_ERROR_INTERRUPTED_UPLOAD_STALL = 'interrupted-upload-stall';
export const JOB_ERROR_DUPLICATE = 'JOB_DUPLICATE';

export interface JobProgress {
  readonly done: number;
  readonly total: number;
  readonly unit?: 'bytes' | 'items';
}

export interface JobResult {
  readonly resourceId?: number;
  readonly wordCount?: number;
  readonly language?: string;
  readonly count?: number;
  readonly format?: string;
  readonly skippedAsDuplicate?: boolean;
  readonly durationMs?: number;
}

export interface Job {
  readonly id: string;
  readonly kind: JobKind;
  readonly label: string;
  readonly status: JobStatus;
  readonly progress: JobProgress;
  readonly params: Readonly<Record<string, unknown>>;
  readonly retryable: boolean;
  readonly resourceId?: number;
  readonly pendingEffect?: boolean;
  readonly error?: string;
  readonly result?: JobResult;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export function isActiveJob(job: Job): boolean {
  return JOB_ACTIVE_STATUSES.includes(job.status);
}

export function isTerminalJob(job: Job): boolean {
  return JOB_TERMINAL_STATUSES.includes(job.status);
}
