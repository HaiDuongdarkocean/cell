import { buildPendingImports, deletingSignatures } from '@/features/dictionary/ui/importJobTypes';
import type { ResourceInfo } from '@/entities/dictionary';
import type { Job, JobStatus } from '@/entities/job/types';

function unfinishedResource(id = 5, signature = 'sig-a'): ResourceInfo {
  return {
    id,
    name: 'landing.zip',
    langCode: 'en',
    type: 'DICTIONARY',
    format: 'txt',
    signature,
    wordCount: 0,
    installationFinished: false,
    importedAt: 0,
  };
}

function registryJob(status: JobStatus, signature = 'sig-a', resourceId = 5): Job {
  return {
    id: `imp-${status}`,
    kind: 'resource-import',
    status,
    label: 'landing.zip',
    progress: { done: 0, total: 0 },
    params: { signature, langCode: 'en' },
    resourceId,
    retryable: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('buildPendingImports — resource coverage', () => {
  it('covers an unfinished resource with a running registry job', () => {
    const { rows, progressByResourceId } = buildPendingImports(
      [unfinishedResource()],
      [],
      [registryJob('running')],
    );
    expect(progressByResourceId.has(5)).toBe(true);
    expect(rows).toHaveLength(0);
  });

  it.each(['failed', 'interrupted', 'done'] as const)(
    'does not cover an unfinished resource with a terminal (%s) registry job',
    (status) => {
      const { progressByResourceId } = buildPendingImports(
        [unfinishedResource()],
        [],
        [registryJob(status)],
      );
      expect(progressByResourceId.has(5)).toBe(false);
    },
  );

  it.each(['failed', 'interrupted'] as const)(
    'keeps a %s registry job visible as its own row so the failure is not swallowed',
    (status) => {
      const { rows } = buildPendingImports(
        [unfinishedResource()],
        [],
        [registryJob(status)],
      );
      expect(rows.some((r) => r.job?.id === `imp-${status}`)).toBe(true);
    },
  );

  it('still lists a queued registry job as its own row', () => {
    const { rows } = buildPendingImports([], [], [registryJob('queued', 'sig-b', 9)]);
    expect(rows.some((r) => r.job?.status === 'queued')).toBe(true);
  });
});

function deleteJob(status: JobStatus, resourceId = 5, done = 0, total = 0, signature?: string): Job {
  return {
    id: `del-${status}`,
    kind: 'resource-delete',
    status,
    label: 'gone.txt',
    progress: { done, total },
    params: { langCode: 'en', resourceId, signature },
    retryable: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

function finishedResource(id = 5, signature = 'sig-a'): ResourceInfo {
  return { ...unfinishedResource(id, signature), installationFinished: true };
}

describe('buildPendingImports — delete coverage', () => {
  it('maps an active delete to its resource card and suppresses the job row', () => {
    const { rows, deletingByResourceId } = buildPendingImports(
      [finishedResource()],
      [],
      [deleteJob('running', 5, 3000, 12000, 'sig-a')],
    );
    expect(deletingByResourceId.get(5)).toEqual({ status: 'running', done: 3000, total: 12000 });
    expect(rows).toHaveLength(0);
  });

  it('keeps the job row when its resource is not listed (delete from elsewhere)', () => {
    const { rows, deletingByResourceId } = buildPendingImports(
      [],
      [],
      [deleteJob('running', 7, 10, 100, 'sig-x')],
    );
    expect(deletingByResourceId.has(7)).toBe(true);
    expect(rows.some((r) => r.job?.id === 'del-running')).toBe(true);
  });

  it('suppresses a done delete row — the vanished card plus alert are the feedback', () => {
    const { rows, deletingByResourceId } = buildPendingImports(
      [finishedResource()],
      [],
      [deleteJob('done', 5)],
    );
    expect(deletingByResourceId.size).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it.each(['failed', 'interrupted'] as const)(
    'keeps a %s delete visible for retry/dismiss',
    (status) => {
      const { rows, deletingByResourceId } = buildPendingImports(
        [finishedResource()],
        [],
        [deleteJob(status, 5)],
      );
      expect(deletingByResourceId.size).toBe(0);
      expect(rows.some((r) => r.job?.id === `del-${status}`)).toBe(true);
    },
  );

  it('exposes a queued delete as deleting progress with waiting status', () => {
    const { deletingByResourceId } = buildPendingImports(
      [finishedResource()],
      [],
      [deleteJob('queued', 5)],
    );
    expect(deletingByResourceId.get(5)).toEqual({ status: 'queued', done: 0, total: 0 });
  });
});

describe('deletingSignatures', () => {
  it('reads the signature from delete params', () => {
    const sigs = deletingSignatures(
      [deleteJob('running', 5, 0, 0, 'sig-a')],
      [],
    );
    expect([...sigs]).toEqual(['sig-a']);
  });

  it('falls back to the still-listed resource row for older jobs', () => {
    const sigs = deletingSignatures(
      [deleteJob('running', 5)],
      [finishedResource(5, 'sig-legacy')],
    );
    expect([...sigs]).toEqual(['sig-legacy']);
  });

  it('ignores terminal deletes and other job kinds', () => {
    const sigs = deletingSignatures(
      [deleteJob('done', 5, 0, 0, 'sig-a'), registryJob('running', 'sig-b', 9)],
      [finishedResource(9, 'sig-b')],
    );
    expect(sigs.size).toBe(0);
  });
});
