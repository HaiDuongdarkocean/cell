import { startImportRunner } from '@/entrypoints/offscreen/importRunner';
import { importFile } from '@/features/dictionary/logic/importOrchestrator';
import type {
  ImportChannelMessage,
  ImportChannelPort,
  ImportRunRequest,
} from '@/features/dictionary/logic/importChannel';
import type { ImportOptions } from '@/entities/dictionary';

jest.mock('@/features/dictionary/logic/importOrchestrator', () => ({
  importFile: jest.fn(),
}));

const mockedImportFile = importFile as jest.MockedFunction<typeof importFile>;

function fakePort(): {
  port: ImportChannelPort;
  posted: ImportChannelMessage[];
  emit: (message: unknown) => void;
} {
  const posted: ImportChannelMessage[] = [];
  let handler: ((message: unknown) => void) | undefined;
  return {
    posted,
    emit: (message) => handler?.(message),
    port: {
      postMessage: (m) => {
        posted.push(m);
      },
      listen: (h) => {
        handler = h;
      },
      close: jest.fn(),
    },
  };
}

function runRequest(overrides: Partial<ImportRunRequest> = {}): ImportRunRequest {
  return {
    type: 'import-run',
    jobId: 'job-1',
    file: new File(['a\nb'], 'list.txt', { type: 'text/plain' }),
    langCode: 'en',
    signature: 'sig-1',
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('importRunner', () => {
  beforeEach(() => {
    mockedImportFile.mockReset();
  });

  it('acks, runs importFile, and posts import-done with the result', async () => {
    const { port, posted, emit } = fakePort();
    startImportRunner(port);
    mockedImportFile.mockResolvedValue({ resourceId: 9, wordCount: 2, format: 'txt' });

    emit(runRequest({ components: ['definitions'], duplicateDecision: 'replace' }));
    await flush();

    expect(posted[0]).toEqual({ type: 'import-accepted', jobId: 'job-1' });
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [file, options] = mockedImportFile.mock.calls[0] as [File, ImportOptions];
    expect(file.name).toBe('list.txt');
    expect(options.langCode).toBe('en');
    expect(options.components).toEqual(['definitions']);
    expect(options.signature).toBe('sig-1');
    await expect(options.onDuplicate?.({} as never)).resolves.toBe('replace');
    expect(posted.at(-1)).toEqual({
      type: 'import-done',
      jobId: 'job-1',
      result: { resourceId: 9, wordCount: 2, format: 'txt' },
    });
  });

  it('relays progress and resource-created callbacks as channel events', async () => {
    const { port, posted, emit } = fakePort();
    startImportRunner(port);
    mockedImportFile.mockImplementation(async (_file, options: ImportOptions) => {
      options.onResourceCreated?.(5);
      options.onProgress?.(10, 100);
      options.onProgress?.(20, 100);
      return { resourceId: 5, wordCount: 20, format: 'txt' };
    });

    emit(runRequest());
    await flush();

    expect(posted).toContainEqual({ type: 'import-resource', jobId: 'job-1', resourceId: 5 });
    expect(posted).toContainEqual({ type: 'import-progress', jobId: 'job-1', done: 10, total: 100 });
    expect(posted).toContainEqual({ type: 'import-progress', jobId: 'job-1', done: 20, total: 100 });
  });

  it('defaults the duplicate decision to skip', async () => {
    const { port, emit } = fakePort();
    startImportRunner(port);
    mockedImportFile.mockResolvedValue({ resourceId: 1, wordCount: 0, format: 'txt', skippedAsDuplicate: true });

    emit(runRequest());
    await flush();

    const [, options] = mockedImportFile.mock.calls[0] as [File, ImportOptions];
    await expect(options.onDuplicate?.({} as never)).resolves.toBe('skip');
  });

  it('posts import-failed with the error message when importFile throws', async () => {
    const { port, posted, emit } = fakePort();
    startImportRunner(port);
    mockedImportFile.mockRejectedValue(new Error('corrupt zip'));

    emit(runRequest());
    await flush();

    expect(posted.at(-1)).toEqual({ type: 'import-failed', jobId: 'job-1', error: 'corrupt zip' });
  });

  it('posts import-failed with a stringified non-Error rejection', async () => {
    const { port, posted, emit } = fakePort();
    startImportRunner(port);
    mockedImportFile.mockRejectedValue('plain-string' as never);

    emit(runRequest());
    await flush();

    expect(posted.at(-1)).toEqual({ type: 'import-failed', jobId: 'job-1', error: 'plain-string' });
  });

  it('ignores non-run messages', () => {
    const { port, posted, emit } = fakePort();
    startImportRunner(port);

    emit({ type: 'import-progress', jobId: 'job-1', done: 1, total: 2 });
    emit({ unrelated: true });

    expect(mockedImportFile).not.toHaveBeenCalled();
    expect(posted).toHaveLength(0);
  });

  it('serializes runs — a second request while busy is ignored', async () => {
    const { port, emit } = fakePort();
    startImportRunner(port);
    let release: (() => void) | undefined;
    mockedImportFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ resourceId: 1, wordCount: 1, format: 'txt' });
        }),
    );

    emit(runRequest({ jobId: 'job-1' }));
    emit(runRequest({ jobId: 'job-2' }));
    await flush();
    expect(mockedImportFile).toHaveBeenCalledTimes(1);

    release?.();
    await flush();
    emit(runRequest({ jobId: 'job-3' }));
    await flush();
    expect(mockedImportFile).toHaveBeenCalledTimes(2);
  });
});
