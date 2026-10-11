import {
  isActiveJob,
  JOB_ERROR_DUPLICATE,
  JOB_ERROR_INTERRUPTED_RESTART,
  type Job,
  type JobKind,
  type JobProgress,
  type JobResult,
  type JobStatus,
} from '@/entities/job/types';

const PROGRESS_PERSIST_THROTTLE_MS = 500;
const PROGRESS_BROADCAST_THROTTLE_MS = 250;

export interface JobExecutor {
  start(job: Job): void | Promise<void>;
  reconcile?(job: Job): Promise<'done' | 'interrupted'>;
}

export interface JobRegistryDeps {
  persist(job: Job): Promise<void>;
  unpersist(id: string): Promise<void>;
  loadPersisted(): Promise<Job[]>;
  broadcast(job: Job): void;
  broadcastRemoved(id: string): void;
  onActiveCountChange?(count: number): void;
  now(): number;
}

export class JobDuplicateError extends Error {
  readonly code = JOB_ERROR_DUPLICATE;
  constructor(identity: string) {
    super(`Active job already exists for ${identity}`);
  }
}

interface RegisterInput {
  readonly id: string;
  readonly kind: JobKind;
  readonly label: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly retryable: boolean;
  readonly status: Extract<JobStatus, 'queued' | 'uploading'>;
}

interface TrackedJob {
  job: Job;
  lastPersistedAt: number;
  persistTimer: ReturnType<typeof setTimeout> | null;
  lastBroadcastAt: number;
  broadcastTimer: ReturnType<typeof setTimeout> | null;
  writeChain: Promise<void>;
}

export function jobIdentityKey(kind: JobKind, params: Readonly<Record<string, unknown>>): string {
  switch (kind) {
    case 'voice-download':
      return `${kind}:${String(params.language ?? '')}`;
    case 'resource-delete':
      return `${kind}:${String(params.resourceId ?? '')}`;
    case 'local-audio-index':
      return `${kind}:${String(params.dslFileHandleId ?? '')}`;
    case 'resource-import':
      return `${kind}:${String(params.signature ?? params.jobId ?? '')}`;
    case 'condense-audio':
      return `${kind}:${String(params.recordId ?? '')}`;
  }
}

export class JobRegistry {
  private readonly deps: JobRegistryDeps;
  private readonly jobs = new Map<string, TrackedJob>();
  private readonly executors = new Map<JobKind, JobExecutor>();
  private readonly maxRunning: Readonly<Partial<Record<JobKind, number>>>;
  private restored = false;
  private writeError: unknown = null;

  constructor(deps: JobRegistryDeps, options?: { maxRunning?: Partial<Record<JobKind, number>> }) {
    this.deps = deps;
    this.maxRunning = options?.maxRunning ?? {};
  }

  registerExecutor(kind: JobKind, executor: JobExecutor): void {
    this.executors.set(kind, executor);
  }

  async restore(): Promise<void> {
    if (this.restored) return;
    const persisted = await this.deps.loadPersisted();
    this.restored = true;
    for (const job of persisted) {
      this.jobs.set(job.id, { job, lastPersistedAt: 0, persistTimer: null, lastBroadcastAt: 0, broadcastTimer: null, writeChain: Promise.resolve() });
    }
    this.notifyActiveCount();
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id)?.job;
  }

  list(kind?: JobKind): Job[] {
    const all = [...this.jobs.values()].map((t) => t.job);
    const filtered = kind === undefined ? all : all.filter((j) => j.kind === kind);
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }

  findActive(kind: JobKind, params: Readonly<Record<string, unknown>>): Job | undefined {
    const key = jobIdentityKey(kind, params);
    return this.list(kind).find((j) => isActiveJob(j) && jobIdentityKey(j.kind, j.params) === key);
  }

  register(input: RegisterInput): Job {
    const key = jobIdentityKey(input.kind, input.params);
    const existing = this.findActive(input.kind, input.params);
    if (existing && existing.id !== input.id) {
      throw new JobDuplicateError(key);
    }
    const tracked = this.jobs.get(input.id);
    if (tracked) return tracked.job;
    const now = this.deps.now();
    const job: Job = {
      id: input.id,
      kind: input.kind,
      label: input.label,
      status: input.status,
      progress: { done: 0, total: 0 },
      params: input.params,
      retryable: input.retryable,
      createdAt: now,
      updatedAt: now,
    };
    this.track(job, true);
    return job;
  }

  private track(job: Job, persistImmediate: boolean): void {
    const tracked: TrackedJob = { job, lastPersistedAt: 0, persistTimer: null, lastBroadcastAt: 0, broadcastTimer: null, writeChain: Promise.resolve() };
    this.jobs.set(job.id, tracked);
    if (persistImmediate) {
      this.flushNow(tracked);
    }
    this.notifyActiveCount();
  }

  update(id: string, patch: Partial<Omit<Job, 'id' | 'kind' | 'createdAt'>>, options?: { persistNow?: boolean }): Job | undefined {
    const tracked = this.jobs.get(id);
    if (!tracked) return undefined;
    tracked.job = { ...tracked.job, ...patch, updatedAt: this.deps.now() };
    const progressOnly = patch.progress !== undefined && Object.keys(patch).every((k) => k === 'progress');
    if (progressOnly) this.broadcastThrottled(tracked);
    else this.broadcastNow(tracked);
    if (options?.persistNow) {
      this.flushNow(tracked);
    } else {
      this.flushThrottled(tracked);
    }
    if (patch.status !== undefined) {
      this.notifyActiveCount();
      this.drainQueue();
    }
    return tracked.job;
  }

  setProgress(id: string, progress: JobProgress): void {
    this.update(id, { progress });
  }

  setResourceId(id: string, resourceId: number): void {
    this.update(id, { resourceId }, { persistNow: true });
  }

  markRunning(id: string): Job | undefined {
    return this.update(id, { status: 'running' }, { persistNow: true });
  }

  markDone(id: string, result?: JobResult): Job | undefined {
    return this.update(id, { status: 'done', result, pendingEffect: undefined, error: undefined }, { persistNow: true });
  }

  markFailed(id: string, error: string, pendingEffect?: boolean): Job | undefined {
    return this.update(id, { status: 'failed', error, pendingEffect }, { persistNow: true });
  }

  markInterrupted(id: string, reason: string): Job | undefined {
    return this.update(id, { status: 'interrupted', error: reason }, { persistNow: true });
  }

  async dismiss(id: string): Promise<boolean> {
    const tracked = this.jobs.get(id);
    if (!tracked) return false;
    if (isActiveJob(tracked.job)) {
      throw new Error('Cannot dismiss a non-terminal job');
    }
    if (tracked.persistTimer !== null) {
      clearTimeout(tracked.persistTimer);
      tracked.persistTimer = null;
    }
    if (tracked.broadcastTimer !== null) {
      clearTimeout(tracked.broadcastTimer);
      tracked.broadcastTimer = null;
    }
    this.jobs.delete(id);
    this.deps.broadcastRemoved(id);
    const unpersistAttempt = tracked.writeChain.then(() => this.deps.unpersist(id));
    tracked.writeChain = unpersistAttempt.catch((err) => {
      console.warn(`[jobRegistry] unpersist failed for ${id}:`, err);
    });
    this.notifyActiveCount();
    await unpersistAttempt;
    return true;
  }

  retry(id: string): Job {
    const tracked = this.jobs.get(id);
    if (!tracked) throw new Error(`Unknown job ${id}`);
    const old = tracked.job;
    if (!old.retryable) throw new Error(`Job ${id} is not retryable`);
    if (isActiveJob(old)) throw new Error(`Job ${id} is still active`);
    const executor = this.executors.get(old.kind);
    if (!executor) throw new Error(`No executor for kind ${old.kind}`);
    const freshId = `${old.id}-r${this.deps.now().toString(36)}`;
    const job = this.register({
      id: freshId,
      kind: old.kind,
      label: old.label,
      params: old.params,
      retryable: old.retryable,
      status: 'queued',
    });
    this.startIfSlotFree(job);
    return job;
  }

  async startJob(id: string): Promise<void> {
    const tracked = this.jobs.get(id);
    if (!tracked || tracked.job.status !== 'queued') return;
    const executor = this.executors.get(tracked.job.kind);
    if (!executor) {
      this.markFailed(id, 'no-executor');
      return;
    }
    this.markRunning(id);
    try {
      await executor.start(tracked.job);
    } catch (err) {
      const current = this.jobs.get(id)?.job;
      if (current && isActiveJob(current)) {
        this.markFailed(id, err instanceof Error ? err.message : String(err));
      }
    }
  }

  startIfSlotFree(job: Job): void {
    if (job.status !== 'queued') return;
    const cap = this.maxRunning[job.kind];
    if (cap !== undefined) {
      const running = this.list(job.kind).filter((j) => j.status === 'running').length;
      if (running >= cap) return;
    }
    void this.startJob(job.id);
  }

  private drainQueue(): void {
    for (const tracked of this.jobs.values()) {
      if (tracked.job.status === 'queued') {
        this.startIfSlotFree(tracked.job);
      }
    }
  }

  async drainWrites(): Promise<void> {
    await Promise.all([...this.jobs.values()].map((t) => t.writeChain));
    const err = this.writeError;
    this.writeError = null;
    if (err !== null) throw err instanceof Error ? err : new Error(String(err));
  }

  async sweep(): Promise<void> {
    const snapshot = this.list();
    for (const job of snapshot) {
      if (isActiveJob(job)) {
        await this.reconcileOne(job);
      } else if (job.status === 'failed' && job.pendingEffect) {
        await this.retryEffect(job);
      }
    }
  }

  private async reconcileOne(job: Job): Promise<void> {
    const executor = this.executors.get(job.kind);
    try {
      const verdict = executor?.reconcile ? await executor.reconcile(job) : 'interrupted';
      if (verdict === 'done') {
        this.markDone(job.id, job.result);
      } else {
        this.markInterrupted(job.id, JOB_ERROR_INTERRUPTED_RESTART);
      }
    } catch (err) {
      this.markInterrupted(job.id, err instanceof Error ? err.message : JOB_ERROR_INTERRUPTED_RESTART);
    }
  }

  private async retryEffect(job: Job): Promise<void> {
    const executor = this.executors.get(job.kind);
    if (!executor?.reconcile) return;
    try {
      const verdict = await executor.reconcile(job);
      if (verdict === 'done') {
        this.markDone(job.id, job.result);
      }
    } catch {
      // stays failed — the next sweep retries again
    }
  }

  private broadcastThrottled(tracked: TrackedJob): void {
    const elapsed = this.deps.now() - tracked.lastBroadcastAt;
    if (elapsed >= PROGRESS_BROADCAST_THROTTLE_MS) {
      this.broadcastNow(tracked);
      return;
    }
    if (tracked.broadcastTimer !== null) return;
    tracked.broadcastTimer = setTimeout(() => {
      tracked.broadcastTimer = null;
      this.broadcastNow(tracked);
    }, PROGRESS_BROADCAST_THROTTLE_MS - elapsed);
  }

  private broadcastNow(tracked: TrackedJob): void {
    if (tracked.broadcastTimer !== null) {
      clearTimeout(tracked.broadcastTimer);
      tracked.broadcastTimer = null;
    }
    tracked.lastBroadcastAt = this.deps.now();
    this.deps.broadcast(tracked.job);
  }

  private flushThrottled(tracked: TrackedJob): void {
    const elapsed = this.deps.now() - tracked.lastPersistedAt;
    if (elapsed >= PROGRESS_PERSIST_THROTTLE_MS) {
      this.flushNow(tracked);
      return;
    }
    if (tracked.persistTimer !== null) return;
    tracked.persistTimer = setTimeout(() => {
      tracked.persistTimer = null;
      this.flushNow(tracked);
    }, PROGRESS_PERSIST_THROTTLE_MS - elapsed);
  }

  private flushNow(tracked: TrackedJob): void {
    if (tracked.persistTimer !== null) {
      clearTimeout(tracked.persistTimer);
      tracked.persistTimer = null;
    }
    tracked.lastPersistedAt = this.deps.now();
    const snapshot = tracked.job;
    tracked.writeChain = tracked.writeChain.then(() =>
      this.deps.persist(snapshot).catch((err) => {
        this.writeError = err;
        console.warn(`[jobRegistry] persist failed for ${snapshot.id}:`, err);
      }),
    );
  }

  private notifyActiveCount(): void {
    if (!this.deps.onActiveCountChange) return;
    let active = 0;
    for (const tracked of this.jobs.values()) {
      if (isActiveJob(tracked.job)) active += 1;
    }
    this.deps.onActiveCountChange(active);
  }
}
