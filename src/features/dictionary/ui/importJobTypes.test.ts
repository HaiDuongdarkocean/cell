import { buildPendingImports } from '@/features/dictionary/ui/importJobTypes';
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
