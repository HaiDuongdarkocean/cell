import { registerLocalAudioHandlers } from './localAudio';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getFileHandle } from '@/shared/lib/storage/localFileHandleStorage';
import { parseLingvoDsl } from '@/features/pronunciation/services/lingvoDslParser';
import { saveLingvoDslIndex } from '@/features/pronunciation/repositories/lingvoDslIndexRepository';
import type { MessageResponse } from '@/entities/message';
import type { LocalAudioBuildIndexResponse, LocalAudioStateResponse } from '@/entities/dictionary';

jest.mock('@/shared/lib/storage/localFileHandleStorage', () => ({
  getFileHandle: jest.fn(),
}));
jest.mock('@/features/pronunciation/services/lingvoDslParser', () => ({
  parseLingvoDsl: jest.fn(),
}));
jest.mock('@/features/pronunciation/repositories/lingvoDslIndexRepository', () => ({
  saveLingvoDslIndex: jest.fn(),
  countLingvoDslIndex: jest.fn(),
}));

jest.mock('./jobs', () => {
  const { JobRegistry } = jest.requireActual<
    typeof import('@/features/jobs/logic/jobRegistry')
  >('@/features/jobs/logic/jobRegistry');
  const registry = new JobRegistry({
    persist: jest.fn(async () => {}),
    unpersist: jest.fn(async () => {}),
    loadPersisted: jest.fn(async () => []),
    broadcast: jest.fn(),
    broadcastRemoved: jest.fn(),
    onActiveCountChange: jest.fn(),
    now: () => Date.now(),
  });
  return { getJobRegistry: () => registry, whenJobsReady: async () => {} };
});

const mockGetFileHandle = jest.mocked(getFileHandle);
const mockParse = jest.mocked(parseLingvoDsl);
const mockSave = jest.mocked(saveLingvoDslIndex);

const testRegistry = jest.requireMock<{
  getJobRegistry: () => import('@/features/jobs/logic/jobRegistry').JobRegistry;
}>('./jobs').getJobRegistry();

async function waitJobTerminal(id: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const job = testRegistry.get(id);
    if (job && (job.status === 'done' || job.status === 'failed' || job.status === 'interrupted')) {
      return job.status;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  return 'timeout';
}

function makeHandle(permission: PermissionState): FileSystemHandle {
  return {
    kind: 'file',
    name: 'archive.zip',
    queryPermission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => permission),
  } as unknown as FileSystemHandle;
}

function createMockCtx(localFile: unknown) {
  const handlers = new Map<string, (request: { payload: unknown }) => Promise<unknown>>();
  return {
    handlers,
    on: (type: string, handler: (request: { payload: unknown }) => Promise<unknown>) => {
      handlers.set(type, handler);
    },
    loadSettings: jest.fn(async () => ({
      pronunciation: localFile ? { localFile } : {},
    })),
    saveSettings: jest.fn(async () => {}),
  };
}

type Ctx = ReturnType<typeof createMockCtx>;

function register(ctx: Ctx) {
  registerLocalAudioHandlers(ctx as unknown as Parameters<typeof registerLocalAudioHandlers>[0]);
  return ctx.handlers.get(MESSAGE_TYPES.LOCAL_AUDIO_STATE)! as
    (request: { payload: unknown }) => Promise<MessageResponse<LocalAudioStateResponse>>;
}

describe('LOCAL_AUDIO_STATE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports unconfigured when no archive handle is stored', async () => {
    const ctx = createMockCtx({ packageType: 'single', audioArchiveHandleId: null });
    const res = await register(ctx)({ payload: {} });
    expect(res).toEqual({ success: true, data: { configured: false, permission: 'none' } });
    expect(mockGetFileHandle).not.toHaveBeenCalled();
  });

  it('reports permission none when the stored handle is missing', async () => {
    mockGetFileHandle.mockResolvedValue(undefined);
    const ctx = createMockCtx({ packageType: 'single', audioArchiveHandleId: 'h1' });
    const res = await register(ctx)({ payload: {} });
    expect(res).toEqual({ success: true, data: { configured: true, permission: 'none' } });
  });

  it('reports prompt so content scripts can surface a reconnect hint', async () => {
    mockGetFileHandle.mockResolvedValue(makeHandle('prompt'));
    const ctx = createMockCtx({ packageType: 'single', audioArchiveHandleId: 'h1' });
    const res = await register(ctx)({ payload: {} });
    expect(res).toEqual({ success: true, data: { configured: true, permission: 'prompt' } });
  });

  it('reports granted for a healthy archive handle', async () => {
    mockGetFileHandle.mockResolvedValue(makeHandle('granted'));
    const ctx = createMockCtx({ packageType: 'single', audioArchiveHandleId: 'h1' });
    const res = await register(ctx)({ payload: {} });
    expect(res).toEqual({ success: true, data: { configured: true, permission: 'granted' } });
  });

  it('reads the split-directory handle for split packages', async () => {
    mockGetFileHandle.mockResolvedValue(makeHandle('prompt'));
    const ctx = createMockCtx({
      packageType: 'split',
      splitArchiveDirectoryHandleId: 'dir1',
      audioArchiveHandleId: null,
    });
    const res = await register(ctx)({ payload: {} });
    expect(mockGetFileHandle).toHaveBeenCalledWith('dir1');
    expect(res).toEqual({ success: true, data: { configured: true, permission: 'prompt' } });
  });
});

describe('LOCAL_AUDIO_BUILD_INDEX', () => {
  function makeFileHandle(permission: PermissionState, text = 'x'): FileSystemHandle {
    return {
      kind: 'file',
      name: 'idx.dsl',
      queryPermission: jest.fn(async () => permission),
      getFile: jest.fn(async () => ({ text: async () => text })),
    } as unknown as FileSystemHandle;
  }

  function registerBuild(ctx: Ctx) {
    registerLocalAudioHandlers(ctx as unknown as Parameters<typeof registerLocalAudioHandlers>[0]);
    return ctx.handlers.get(MESSAGE_TYPES.LOCAL_AUDIO_BUILD_INDEX)! as
      (request: { payload: unknown }) => Promise<MessageResponse<LocalAudioBuildIndexResponse>>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses the dsl file and persists the index', async () => {
    mockGetFileHandle.mockResolvedValue(makeFileHandle('granted', 'dsl text'));
    mockParse.mockReturnValue([
      { id: 'h:hello', packageId: 'h', term: 'hello', audioPaths: ['a.mp3'] },
    ]);
    const ctx = createMockCtx({ dslFileHandleId: 'h', lastIndexedAt: null });
    const handler = registerBuild(ctx);
    const res = await handler({ payload: { dslFileHandleId: 'h' } });
    expect(res.success).toBe(true);
    const jobId = (res.data as { jobId: string }).jobId;
    expect(typeof jobId).toBe('string');
    expect(await waitJobTerminal(jobId)).toBe('done');
    expect(mockParse).toHaveBeenCalledWith('dsl text', 'h');
    expect(mockSave).toHaveBeenCalledWith('h', expect.any(Array));
    expect(ctx.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        pronunciation: expect.objectContaining({
          localFile: expect.objectContaining({ lastIndexedAt: expect.any(Number) }),
        }),
      }),
    );
  });

  it('fails the job when the handle is missing', async () => {
    mockGetFileHandle.mockResolvedValue(undefined);
    const handler = registerBuild(createMockCtx(null));
    const res = await handler({ payload: { dslFileHandleId: 'gone' } });
    expect(res.success).toBe(true);
    const jobId = (res.data as { jobId: string }).jobId;
    expect(await waitJobTerminal(jobId)).toBe('failed');
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('fails the job without read permission', async () => {
    mockGetFileHandle.mockResolvedValue(makeFileHandle('prompt'));
    const handler = registerBuild(createMockCtx(null));
    const res = await handler({ payload: { dslFileHandleId: 'h' } });
    expect(res.success).toBe(true);
    const jobId = (res.data as { jobId: string }).jobId;
    expect(await waitJobTerminal(jobId)).toBe('failed');
    expect(testRegistry.get(jobId)?.error).toContain('permission');
  });
});

describe('LOCAL_AUDIO_OPEN_RECONNECT', () => {
  it('opens the extension popup page via chrome.tabs.create', async () => {
    const create = jest.fn(async () => ({ id: 7 }));
    const getURL = jest.fn((p: string) => `chrome-extension://ext/${p}`);
    (globalThis as Record<string, unknown>).chrome = {
      ...(globalThis.chrome as object | undefined),
      tabs: { create },
      runtime: { ...(globalThis.chrome?.runtime as object | undefined), getURL },
    };
    const ctx = createMockCtx(null);
    registerLocalAudioHandlers(ctx as unknown as Parameters<typeof registerLocalAudioHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.LOCAL_AUDIO_OPEN_RECONNECT)!;
    const res = await handler({ payload: {} }) as { success: boolean; data?: { tabId: number } };
    expect(res).toEqual({ success: true, data: { tabId: 7 } });
    expect(create).toHaveBeenCalledWith({
      url: 'chrome-extension://ext/src/entrypoints/popup/index.html',
    });
  });
});
