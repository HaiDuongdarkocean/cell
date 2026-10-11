import { gzipSync } from 'fflate';
import { registerResourceHandlers } from '@/entrypoints/background/handlers/resources';
import { importFile } from '@/features/dictionary/logic/importOrchestrator';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { clearDictionaryProbeCache } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import type { BackgroundContext } from '@/entrypoints/background/context';
import type { MessageRequest, MessageResponse } from '@/entities/message';

jest.mock('@/features/dictionaryPopup/logic/lookupOrchestrator', () => ({
  clearDictionaryProbeCache: jest.fn(),
}));

jest.mock('@/features/dictionary/repositories/resourceRepository', () => ({
  getAllResources: jest.fn(async () => []),
  getResource: jest.fn(),
  reorderResources: jest.fn(),
  setResourceEnabled: jest.fn(),
  setResourceName: jest.fn(),
  setResourceProfiles: jest.fn(),
  setResourceDisabledComponents: jest.fn(),
  setResourceComponents: jest.fn(),
}));

jest.mock('@/features/dictionary/repositories/resourceEntryRepository', () => ({
  sampleDictionaryEntries: jest.fn(async () => []),
  findDictionaryEntry: jest.fn(),
  findDictionaryByResource: jest.fn(async () => []),
  sampleFrequencyEntries: jest.fn(async () => []),
  findFrequencyEntry: jest.fn(),
  findFrequencyByResource: jest.fn(async () => []),
}));

jest.mock('@/features/dictionary/logic/dictionaryComponents', () => ({
  collectEntryComponents: jest.fn(() => new Set()),
  sortedComponents: jest.fn(() => []),
}));

jest.mock('@/features/dictionary/logic/importOrchestrator', () => ({
  importFile: jest.fn(async () => ({ resourceId: 7, wordCount: 1, format: 'txt' })),
  deleteResourceCascade: jest.fn(),
  rollbackImport: jest.fn(),
}));

const mockRegistry = {
  jobs: new Map<string, Record<string, unknown>>(),
  executors: new Map<string, { start: (job: never) => Promise<void>; reconcile: unknown }>(),
  register(job: Record<string, unknown> & { id: string }) {
    this.jobs.set(job.id, { ...job });
    return this.jobs.get(job.id);
  },
  get(id: string) {
    return this.jobs.get(id);
  },
  setProgress: jest.fn(),
  update(id: string, patch: Record<string, unknown>) {
    const job = this.jobs.get(id);
    if (job) Object.assign(job, patch);
    return job;
  },
  startIfSlotFree(job: { id: string; kind: string }) {
    const ex = this.executors.get(job.kind);
    if (ex) void ex.start(job as never);
  },
  registerExecutor(kind: string, ex: { start: (job: never) => Promise<void>; reconcile: unknown }) {
    this.executors.set(kind, ex);
  },
  markDone: jest.fn(),
  markInterrupted: jest.fn(),
  markFailed(id: string, error: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'failed';
      job.error = error;
    }
    return job;
  },
};

jest.mock('@/entrypoints/background/handlers/jobs', () => ({
  getJobRegistry: jest.fn(() => mockRegistry),
  whenJobsReady: jest.fn(async () => undefined),
}));

jest.mock('@/shared/i18n', () => ({ t: (key: string) => key }));

type Handler = (request: MessageRequest) => Promise<MessageResponse<unknown>>;

function readFileBytes(file: File): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function makeContext() {
  const handlers = new Map<string, Handler>();
  const ctx = {
    on: jest.fn((type: string, fn: Handler) => {
      handlers.set(type, fn);
    }),
  } as unknown as BackgroundContext;
  registerResourceHandlers(ctx);
  return handlers;
}

const mockedClear = clearDictionaryProbeCache as jest.MockedFunction<typeof clearDictionaryProbeCache>;
const mockedImportFile = importFile as jest.MockedFunction<typeof importFile>;

describe('resource handlers — lookup context invalidation', () => {
  beforeEach(() => {
    mockedClear.mockClear();
  });

  it('RESOURCE_RENAME clears the lookup cache', async () => {
    const handlers = makeContext();
    const res = await handlers.get(MESSAGE_TYPES.RESOURCE_RENAME)!({
      type: MESSAGE_TYPES.RESOURCE_RENAME,
      payload: { langCode: 'en', resourceId: 1, name: 'new-name' },
    } as MessageRequest);
    expect(res).toMatchObject({ success: true });
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });

  it('RESOURCE_SET_COMPONENTS clears the lookup cache', async () => {
    const handlers = makeContext();
    const res = await handlers.get(MESSAGE_TYPES.RESOURCE_SET_COMPONENTS)!({
      type: MESSAGE_TYPES.RESOURCE_SET_COMPONENTS,
      payload: { langCode: 'en', resourceId: 1, disabledComponents: ['examples'] },
    } as MessageRequest);
    expect(res).toMatchObject({ success: true });
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });
});

describe('resource import chunks — live component selection', () => {
  beforeEach(() => {
    mockRegistry.jobs.clear();
    mockedImportFile.mockClear();
  });

  const whole = Buffer.from('fake-bytes-for-import').toString('base64');
  const slices = [whole.slice(0, 8), whole.slice(8, 16), whole.slice(16)];
  const chunk = (jobId: string, seq: number, total: number, components: string[] | undefined) => ({
    type: MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
    payload: {
      jobId, seq, total,
      data: slices[seq]!,
      fileName: 'list.txt', fileMime: 'text/plain', langCode: 'en',
      components,
    },
  } as MessageRequest);

  it('hands the last chunk’s component selection to the executor', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    await send(chunk('job-live', 0, 3, ['definitions', 'frequency']));
    await send(chunk('job-live', 1, 3, ['definitions']));
    const res = await send(chunk('job-live', 2, 3, ['definitions']));
    expect((res as { error?: string }).error).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [, opts] = mockedImportFile.mock.calls[0]!;
    expect(opts.components).toEqual(['definitions']);
  });

  it('reassembles chunked base64 into the original file bytes for the executor', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    await send(chunk('job-bytes', 0, 3, undefined));
    await send(chunk('job-bytes', 1, 3, undefined));
    await send(chunk('job-bytes', 2, 3, undefined));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [file] = mockedImportFile.mock.calls[0]!;
    const bytes = await readFileBytes(file as File);
    expect(bytes.equals(Buffer.from('fake-bytes-for-import'))).toBe(true);
  });

  it('uses the first selection unchanged when chunks carry none', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    await send(chunk('job-plain', 0, 2, undefined));
    const res = await send(chunk('job-plain', 1, 2, undefined));
    expect((res as { error?: string }).error).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [, opts] = mockedImportFile.mock.calls[0]!;
    expect(opts.components).toBeUndefined();
  });

  it('rejects a malformed-base64 chunk and fails the job', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    const bad = {
      type: MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
      payload: {
        jobId: 'job-bad', seq: 0, total: 2,
        data: '%%%not-base64%%%',
        fileName: 'list.txt', fileMime: 'text/plain', langCode: 'en',
      },
    } as MessageRequest;
    const res = await send(bad);
    expect((res as { error?: string }).error).toBeTruthy();
    const job = mockRegistry.jobs.get('job-bad');
    expect(job?.status).toBe('failed');
    const retry = await send({
      type: MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
      payload: {
        jobId: 'job-bad2', seq: 0, total: 1,
        data: slices[0]!,
        fileName: 'list.txt', fileMime: 'text/plain', langCode: 'en',
      },
    } as MessageRequest);
    expect((retry as { error?: string }).error).toBeUndefined();
  });
});

describe('resource import chunks — gzip transport', () => {
  beforeEach(() => {
    mockRegistry.jobs.clear();
    mockedImportFile.mockClear();
  });

  const rawBytes = Buffer.from('fake-bytes-for-import');
  const gzippedB64 = Buffer.from(gzipSync(new Uint8Array(rawBytes))).toString('base64');
  const gzSlices = [gzippedB64.slice(0, 12), gzippedB64.slice(12, 24), gzippedB64.slice(24)];
  const gzChunk = (jobId: string, seq: number, withEncoding: boolean) => ({
    type: MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
    payload: {
      jobId, seq, total: gzSlices.length,
      data: gzSlices[seq]!,
      fileName: 'list.txt', fileMime: 'text/plain', langCode: 'en',
      encoding: withEncoding ? 'gzip' : undefined,
    },
  } as MessageRequest);

  it('gunzips an encoding:gzip stream so the executor sees the original bytes', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    await send(gzChunk('job-gz', 0, true));
    await send(gzChunk('job-gz', 1, true));
    const res = await send(gzChunk('job-gz', 2, true));
    expect((res as { error?: string }).error).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [file] = mockedImportFile.mock.calls[0]!;
    const bytes = await readFileBytes(file as File);
    expect(bytes.equals(rawBytes)).toBe(true);
  });

  it('gunzips when only the first chunk carries the encoding marker', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    await send(gzChunk('job-gz-first', 0, true));
    await send(gzChunk('job-gz-first', 1, false));
    const res = await send(gzChunk('job-gz-first', 2, false));
    expect((res as { error?: string }).error).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [file] = mockedImportFile.mock.calls[0]!;
    const bytes = await readFileBytes(file as File);
    expect(bytes.equals(rawBytes)).toBe(true);
  });

  it('gunzips chunks that land out of order', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    await send(gzChunk('job-gz-ooo', 1, true));
    await send(gzChunk('job-gz-ooo', 0, true));
    const res = await send(gzChunk('job-gz-ooo', 2, true));
    expect((res as { error?: string }).error).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedImportFile).toHaveBeenCalledTimes(1);
    const [file] = mockedImportFile.mock.calls[0]!;
    const bytes = await readFileBytes(file as File);
    expect(bytes.equals(rawBytes)).toBe(true);
  });

  it('fails the job when a gzip stream ends torn mid-upload', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    const b64 = Buffer.from(gzipSync(new Uint8Array(rawBytes))).toString('base64');
    const mid = Math.floor(b64.length / 8) * 4;
    const torn = (seq: number) => ({
      type: MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
      payload: {
        jobId: 'job-gz-torn', seq, total: 2,
        data: seq === 0 ? b64.slice(0, mid) : b64.slice(mid, mid + 8),
        fileName: 'list.txt', fileMime: 'text/plain', langCode: 'en',
        encoding: 'gzip',
      },
    } as MessageRequest);
    const first = await send(torn(0));
    expect((first as { error?: string }).error).toBeUndefined();
    const second = await send(torn(1));
    expect((second as { error?: string }).error).toBeTruthy();
    const job = mockRegistry.jobs.get('job-gz-torn');
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('invalid-gzip-payload');
    expect(mockedImportFile).not.toHaveBeenCalled();
  });

  it('fails the job when a flagged-gzip payload is not valid gzip', async () => {
    const handlers = makeContext();
    const send = handlers.get(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)!;
    const res = await send({
      type: MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK,
      payload: {
        jobId: 'job-gz-bad', seq: 0, total: 1,
        data: Buffer.from('not-gzip-at-all').toString('base64'),
        fileName: 'list.txt', fileMime: 'text/plain', langCode: 'en',
        encoding: 'gzip',
      },
    } as MessageRequest);
    expect((res as { error?: string }).error).toBeTruthy();
    const job = mockRegistry.jobs.get('job-gz-bad');
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('invalid-gzip-payload');
    expect(mockedImportFile).not.toHaveBeenCalled();
  });
});
