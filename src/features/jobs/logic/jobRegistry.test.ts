import { JobRegistry, JobDuplicateError, jobIdentityKey, type JobRegistryDeps } from './jobRegistry';
import type { Job, JobKind } from '@/entities/job/types';

async function tick(n = 4): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

function makeDeps(persisted: Job[] = []): JobRegistryDeps & {
  persisted: Map<string, Job>;
  events: Job[];
  removed: string[];
  activeCounts: number[];
} {
  const persistedMap = new Map<string, Job>(persisted.map((j) => [j.id, j]));
  const events: Job[] = [];
  const removed: string[] = [];
  const activeCounts: number[] = [];
  return {
    persisted: persistedMap,
    events,
    removed,
    activeCounts,
    persist: jest.fn(async (job: Job) => { persistedMap.set(job.id, job); }),
    unpersist: jest.fn(async (id: string) => { persistedMap.delete(id); }),
    loadPersisted: jest.fn(async () => [...persistedMap.values()]),
    broadcast: jest.fn((job: Job) => { events.push(job); }),
    broadcastRemoved: jest.fn((id: string) => { removed.push(id); }),
    onActiveCountChange: jest.fn((count: number) => { activeCounts.push(count); }),
    now: jest.fn(() => Date.now()),
  };
}

function reg(deps: JobRegistryDeps, opts?: { maxRunning?: Partial<Record<JobKind, number>> }): JobRegistry {
  return new JobRegistry(deps, opts);
}

const base = { params: {}, retryable: true };

describe('JobRegistry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('registers and persists a job immediately', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    const job = r.register({ id: 'j1', kind: 'voice-download', label: 'en', status: 'queued', ...base, params: { language: 'en' } });
    expect(job.status).toBe('queued');
    await r.drainWrites();expect(deps.persist).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }));
  });

  it('rejects duplicate active job with same identity', () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.register({ id: 'j1', kind: 'voice-download', label: 'en', status: 'queued', ...base, params: { language: 'en' } });
    r.markRunning('j1');
    expect(() => r.register({ id: 'j2', kind: 'voice-download', label: 'en2', status: 'queued', ...base, params: { language: 'en' } }))
      .toThrow(JobDuplicateError);
  });

  it('allows same identity once the old job is terminal', () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.register({ id: 'j1', kind: 'voice-download', label: 'en', status: 'queued', ...base, params: { language: 'en' } });
    r.markRunning('j1');
    r.markDone('j1');
    expect(() => r.register({ id: 'j2', kind: 'voice-download', label: 'en2', status: 'queued', ...base, params: { language: 'en' } })).not.toThrow();
  });

  it('throttles progress persists but flushes terminal states immediately', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.register({ id: 'j1', kind: 'resource-delete', label: 'd', status: 'queued', ...base });
    r.markRunning('j1');
    r.setProgress('j1', { done: 1, total: 10 });
    r.setProgress('j1', { done: 2, total: 10 });
    jest.advanceTimersByTime(600);
    r.markDone('j1', { count: 10 });
    await r.drainWrites();
    const job = deps.persisted.get('j1');
    expect(job?.status).toBe('done');
    expect(job?.result?.count).toBe(10);
    expect(deps.events.at(-1)?.status).toBe('done');
  });

  it('persists resourceId assignment immediately (not throttled)', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.register({ id: 'j1', kind: 'resource-import', label: 'f', status: 'uploading', ...base });
    r.setResourceId('j1', 42);
    await r.drainWrites();
    expect(deps.persisted.get('j1')?.resourceId).toBe(42);
  });

  it('dismiss removes a terminal job everywhere and rejects non-terminal', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.register({ id: 'j1', kind: 'resource-delete', label: 'd', status: 'queued', ...base });
    r.markRunning('j1');
    await expect(r.dismiss('j1')).rejects.toThrow('non-terminal');
    r.markFailed('j1', 'boom');
    await expect(r.dismiss('j1')).resolves.toBe(true);
    expect(deps.removed).toContain('j1');
    expect(deps.persisted.has('j1')).toBe(false);
  });

  it('retry spawns a new job under a new id for retryable kinds only', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    const start = jest.fn();
    r.registerExecutor('voice-download', { start });
    r.register({ id: 'imp1', kind: 'resource-import', label: 'f', status: 'uploading', ...base, retryable: false });
    r.markInterrupted('imp1', 'interrupted-upload-stall');
    expect(() => r.retry('imp1')).toThrow('not retryable');

    r.register({ id: 'v1', kind: 'voice-download', label: 'en', status: 'queued', ...base, params: { language: 'en' } });
    r.markRunning('v1');
    r.markFailed('v1', 'network');
    const next = r.retry('v1');
    expect(next.id).not.toBe('v1');
    await tick();
    expect(r.get(next.id)?.status).toBe('running');
    expect(start).toHaveBeenCalled();
    expect(r.get('v1')?.status).toBe('failed');
  });

  it('caps concurrent running jobs per kind and drains queue on terminal', async () => {
    const deps = makeDeps();
    const r = reg(deps, { maxRunning: { 'resource-import': 2 } });
    const started: string[] = [];
    r.registerExecutor('resource-import', { start: (j) => { started.push(j.id); } });
    for (let i = 1; i <= 4; i++) {
      const j = r.register({ id: `i${i}`, kind: 'resource-import', label: `f${i}`, status: 'queued', ...base, params: { jobId: `i${i}` } });
      r.startIfSlotFree(j);
    }
    expect(started.sort()).toEqual(['i1', 'i2']);
    expect(r.get('i3')?.status).toBe('queued');
    r.markDone('i1');
    await tick();
    expect(started).toContain('i3');
  });

  it('boot sweep marks running jobs interrupted by default', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.register({ id: 'j1', kind: 'resource-import', label: 'f', status: 'queued', ...base });
    r.markRunning('j1');
    await r.drainWrites();
    const r2 = reg(deps);
    await r2.restore();
    await r2.sweep();
    expect(r2.get('j1')?.status).toBe('interrupted');
    expect(r2.get('j1')?.error).toBe('interrupted-restart');
  });

  it('boot sweep reconcile can mark a job done when completion is durable', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.registerExecutor('voice-download', { start: jest.fn(), reconcile: async () => 'done' });
    r.register({ id: 'v1', kind: 'voice-download', label: 'en', status: 'queued', ...base, params: { language: 'en' } });
    r.markRunning('v1');
    await r.drainWrites();
    const r2 = reg(deps);
    r2.registerExecutor('voice-download', { start: jest.fn(), reconcile: async () => 'done' });
    await r2.restore();
    await r2.sweep();
    expect(r2.get('v1')?.status).toBe('done');
  });

  it('boot sweep retries pendingEffect on failed jobs', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    const reconcile = jest.fn(async () => 'done' as const);
    r.registerExecutor('local-audio-index', { start: jest.fn(), reconcile });
    r.register({ id: 'x1', kind: 'local-audio-index', label: 'dsl', status: 'queued', ...base, params: { dslFileHandleId: 'h1' } });
    r.markRunning('x1');
    r.markFailed('x1', 'effect failed', true);
    await r.drainWrites();
    const r2 = reg(deps);
    r2.registerExecutor('local-audio-index', { start: jest.fn(), reconcile });
    await r2.restore();
    await r2.sweep();
    expect(r2.get('x1')?.status).toBe('done');
  });

  it('tracks active count for keep-alive pinning', async () => {
    const deps = makeDeps();
    const r = reg(deps);
    await r.restore();
    r.register({ id: 'j1', kind: 'resource-delete', label: 'd', status: 'queued', ...base });
    r.markRunning('j1');
    r.markDone('j1');
    expect(deps.activeCounts.at(-1)).toBe(0);
    expect(deps.activeCounts).toContain(1);
  });

  it('JOB_EVENT broadcast fires on every update', () => {
    const deps = makeDeps();
    const r = reg(deps);
    r.register({ id: 'j1', kind: 'resource-delete', label: 'd', status: 'queued', ...base });
    r.markRunning('j1');
    r.setProgress('j1', { done: 5, total: 9 });
    expect(deps.events.at(-1)?.progress.done).toBe(5);
  });
});

describe('jobIdentityKey', () => {
  it('keys by the documented fields', () => {
    expect(jobIdentityKey('voice-download', { language: 'en' })).toBe('voice-download:en');
    expect(jobIdentityKey('resource-delete', { resourceId: 7 })).toBe('resource-delete:7');
    expect(jobIdentityKey('local-audio-index', { dslFileHandleId: 'h' })).toBe('local-audio-index:h');
    expect(jobIdentityKey('resource-import', { signature: 's' })).toBe('resource-import:s');
  });
});
