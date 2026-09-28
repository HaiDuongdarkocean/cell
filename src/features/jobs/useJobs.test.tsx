import { act, renderHook, waitFor } from '@testing-library/react';
import { useJobs } from './useJobs';
import type { Job } from '@/entities/job/types';

type JobEvent = { job?: Job; removedId?: string };

const listeners = new Set<(event: JobEvent) => void>();
let listDeferred: { resolve: (jobs: Job[]) => void } | null = null;

jest.mock('./jobClient', () => ({
  listJobs: jest.fn(() => new Promise<Job[]>((resolve) => {
    listDeferred = { resolve };
  })),
  subscribeJobEvents: jest.fn((listener: (event: JobEvent) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }),
}));

function makeJob(id: string, status: Job['status'], updatedAt: number): Job {
  return {
    id,
    kind: 'resource-import',
    label: id,
    status,
    progress: { done: 0, total: 0 },
    params: {},
    retryable: false,
    createdAt: updatedAt,
    updatedAt,
  };
}

function emit(event: JobEvent): void {
  act(() => {
    for (const listener of listeners) listener(event);
  });
}

describe('useJobs', () => {
  beforeEach(() => {
    listeners.clear();
    listDeferred = null;
  });

  it('keeps a newer JOB_EVENT update when the JOB_LIST response resolves with a stale snapshot', async () => {
    const { result } = renderHook(() => useJobs());

    emit({ job: makeJob('j1', 'done', 200) });
    await waitFor(() => expect(result.current.find((j) => j.id === 'j1')?.status).toBe('done'));

    act(() => {
      listDeferred?.resolve([makeJob('j1', 'running', 100)]);
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]?.status).toBe('done');
    expect(result.current[0]?.updatedAt).toBe(200);
  });

  it('applies the list snapshot for jobs the event stream has not seen', async () => {
    const { result } = renderHook(() => useJobs());
    act(() => {
      listDeferred?.resolve([makeJob('j1', 'running', 100), makeJob('j2', 'queued', 90)]);
    });
    await waitFor(() => expect(result.current).toHaveLength(2));
  });

  it('drops a job when a removedId event arrives', async () => {
    const { result } = renderHook(() => useJobs());
    emit({ job: makeJob('j1', 'done', 100) });
    await waitFor(() => expect(result.current).toHaveLength(1));
    emit({ removedId: 'j1' });
    await waitFor(() => expect(result.current).toHaveLength(0));
  });
});
