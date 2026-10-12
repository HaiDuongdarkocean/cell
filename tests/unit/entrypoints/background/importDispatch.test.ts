import {
  dispatchImportToOffscreen,
  executeResourceImport,
} from '@/entrypoints/background/importDispatch';
import { importFile, rollbackImport } from '@/features/dictionary/logic/importOrchestrator';
import { isOffscreenSupported } from '@/shared/lib/chrome-apis';
import type {
  ImportChannelMessage,
  ImportChannelPort,
  ImportRunRequest,
} from '@/features/dictionary/logic/importChannel';
import { JOB_ERROR_INTERRUPTED_OFFSCREEN } from '@/entities/job/types';
import type { Job } from '@/entities/job/types';
import type { JobRegistry } from '@/features/jobs/logic/jobRegistry';
import type { OffscreenManager } from '@/entrypoints/background/offscreenManager';

jest.mock('@/features/dictionary/logic/importOrchestrator', () => ({
  importFile: jest.fn(),
  rollbackImport: jest.fn(async () => undefined),
}));

jest.mock('@/shared/lib/chrome-apis', () => ({
  ...jest.requireActual('@/shared/lib/chrome-apis'),
  isOffscreenSupported: jest.fn(() => true),
}));

const mockedImportFile = importFile as jest.MockedFunction<typeof importFile>;
const mockedRollback = rollbackImport as jest.MockedFunction<typeof rollbackImport>;
const mockedSupported = isOffscreenSupported as jest.MockedFunction<typeof isOffscreenSupported>;

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    kind: 'resource-import',
    label: 'list.txt',
    status: 'running',
    progress: { done: 0, total: 0 },
    params: { signature: 'sig-1' },
    retryable: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeRegistry() {
  return {
    setProgress: jest.fn(),
    setResourceId: jest.fn(),
    markInterrupted: jest.fn(),
    markDone: jest.fn(),
    get: jest.fn(),
  };
}

function makeOffscreen() {
  return {
    ensureOffscreenReady: jest.fn(async () => undefined),
    sendToOffscreen: jest.fn(async () => ({ success: true })),
  };
}

function fakePort(): {
  port: ImportChannelPort;
  posted: ImportChannelMessage[];
  emit: (message: unknown) => void;
  closed: () => boolean;
} {
  const posted: ImportChannelMessage[] = [];
  let handler: ((message: unknown) => void) | undefined;
  let closed = false;
  return {
    posted,
    closed: () => closed,
    emit: (message) => handler?.(message),
    port: {
      postMessage: (m) => {
        posted.push(m);
      },
      listen: (h) => {
        handler = h;
      },
      close: () => {
        closed = true;
      },
    },
  };
}

const payload = {
  file: new File(['x'], 'list.txt', { type: 'text/plain' }),
  langCode: 'en',
  components: ['definitions' as const],
  duplicateDecision: 'replace' as const,
};

function lastRequest(posted: ImportChannelMessage[]): ImportRunRequest {
  return posted.find((m) => m.type === 'import-run') as ImportRunRequest;
}

describe('dispatchImportToOffscreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('posts the run request with file, meta, and job signature', async () => {
    const { port, posted, emit } = fakePort();
    const promise = dispatchImportToOffscreen(
      makeOffscreen() as unknown as OffscreenManager,
      makeRegistry() as unknown as JobRegistry,
      makeJob(),
      payload,
      port,
    );
    emit({ type: 'import-accepted', jobId: 'job-1' });
    emit({ type: 'import-done', jobId: 'job-1', result: { resourceId: 3, wordCount: 1, format: 'txt' } });
    await promise;

    const request = lastRequest(posted);
    expect(request.jobId).toBe('job-1');
    expect(request.file).toBe(payload.file);
    expect(request.langCode).toBe('en');
    expect(request.components).toEqual(['definitions']);
    expect(request.signature).toBe('sig-1');
    expect(request.duplicateDecision).toBe('replace');
  });

  it('maps progress and resource events onto the registry and resolves with the result', async () => {
    const { port, emit, closed } = fakePort();
    const registry = makeRegistry();
    const promise = dispatchImportToOffscreen(
      makeOffscreen() as unknown as OffscreenManager,
      registry as unknown as JobRegistry,
      makeJob(),
      payload,
      port,
    );

    emit({ type: 'import-accepted', jobId: 'job-1' });
    emit({ type: 'import-progress', jobId: 'job-1', done: 10, total: 100 });
    emit({ type: 'import-resource', jobId: 'job-1', resourceId: 7 });
    emit({ type: 'import-done', jobId: 'job-1', result: { resourceId: 7, wordCount: 100, format: 'txt' } });

    await expect(promise).resolves.toEqual({ resourceId: 7, wordCount: 100, format: 'txt' });
    expect(registry.setProgress).toHaveBeenCalledWith('job-1', { done: 10, total: 100 });
    expect(registry.setResourceId).toHaveBeenCalledWith('job-1', 7);
    expect(closed()).toBe(true);
  });

  it('ignores events for a different job id', async () => {
    const { port, emit } = fakePort();
    const registry = makeRegistry();
    const promise = dispatchImportToOffscreen(
      makeOffscreen() as unknown as OffscreenManager,
      registry as unknown as JobRegistry,
      makeJob(),
      payload,
      port,
    );

    emit({ type: 'import-progress', jobId: 'other-job', done: 5, total: 5 });
    emit({ type: 'import-done', jobId: 'other-job', result: { resourceId: 1, wordCount: 1, format: 'txt' } });
    emit({ type: 'import-done', jobId: 'job-1', result: { resourceId: 2, wordCount: 2, format: 'txt' } });

    await expect(promise).resolves.toMatchObject({ resourceId: 2 });
    expect(registry.setProgress).not.toHaveBeenCalled();
  });

  it('rejects with the runner error and does not mark interrupted or roll back', async () => {
    const { port, emit } = fakePort();
    const registry = makeRegistry();
    const promise = dispatchImportToOffscreen(
      makeOffscreen() as unknown as OffscreenManager,
      registry as unknown as JobRegistry,
      makeJob(),
      payload,
      port,
    );

    emit({ type: 'import-resource', jobId: 'job-1', resourceId: 7 });
    emit({ type: 'import-failed', jobId: 'job-1', error: 'corrupt zip' });

    await expect(promise).rejects.toThrow('corrupt zip');
    expect(registry.markInterrupted).not.toHaveBeenCalled();
    expect(mockedRollback).not.toHaveBeenCalled();
  });

  it('interrupts the job when the runner never acks', async () => {
    jest.useFakeTimers();
    const { port, closed } = fakePort();
    const registry = makeRegistry();
    const promise = dispatchImportToOffscreen(
      makeOffscreen() as unknown as OffscreenManager,
      registry as unknown as JobRegistry,
      makeJob(),
      payload,
      port,
    );

    jest.advanceTimersByTime(10_001);
    await expect(promise).rejects.toThrow(JOB_ERROR_INTERRUPTED_OFFSCREEN);
    expect(registry.markInterrupted).toHaveBeenCalledWith('job-1', JOB_ERROR_INTERRUPTED_OFFSCREEN);
    expect(closed()).toBe(true);
  });

  it('interrupts and rolls back the half-installed resource when the document dies', async () => {
    jest.useFakeTimers();
    const { port, emit } = fakePort();
    const offscreen = makeOffscreen();
    const registry = makeRegistry();
    const promise = dispatchImportToOffscreen(
      offscreen as unknown as OffscreenManager,
      registry as unknown as JobRegistry,
      makeJob(),
      payload,
      port,
    );

    emit({ type: 'import-accepted', jobId: 'job-1' });
    emit({ type: 'import-resource', jobId: 'job-1', resourceId: 7 });
    offscreen.sendToOffscreen.mockRejectedValueOnce(new Error('Could not establish connection'));
    jest.advanceTimersByTime(25_000);
    await Promise.resolve();

    await expect(promise).rejects.toThrow(JOB_ERROR_INTERRUPTED_OFFSCREEN);
    expect(registry.markInterrupted).toHaveBeenCalledWith('job-1', JOB_ERROR_INTERRUPTED_OFFSCREEN);
    expect(mockedRollback).toHaveBeenCalledWith('en', 7);
  });
});

describe('executeResourceImport — path selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSupported.mockReturnValue(true);
  });

  it('runs importFile in-process when chrome.offscreen is unsupported (Firefox)', async () => {
    mockedSupported.mockReturnValue(false);
    mockedImportFile.mockResolvedValue({ resourceId: 4, wordCount: 3, format: 'txt' });
    const offscreen = makeOffscreen();

    const result = await executeResourceImport(
      offscreen as unknown as OffscreenManager,
      makeRegistry() as unknown as JobRegistry,
      makeJob(),
      payload,
    );

    expect(result).toEqual({ resourceId: 4, wordCount: 3, format: 'txt' });
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    expect(offscreen.ensureOffscreenReady).not.toHaveBeenCalled();
  });

  it('falls back to in-process import when the offscreen document cannot start', async () => {
    const offscreen = makeOffscreen();
    offscreen.ensureOffscreenReady.mockRejectedValue(new Error('createDocument failed'));
    mockedImportFile.mockResolvedValue({ resourceId: 5, wordCount: 2, format: 'txt' });

    const result = await executeResourceImport(
      offscreen as unknown as OffscreenManager,
      makeRegistry() as unknown as JobRegistry,
      makeJob(),
      payload,
    );

    expect(result).toEqual({ resourceId: 5, wordCount: 2, format: 'txt' });
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [, options] = mockedImportFile.mock.calls[0]!;
    expect(options.langCode).toBe('en');
    expect(options.signature).toBe('sig-1');
  });
});
