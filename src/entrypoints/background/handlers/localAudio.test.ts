import { registerLocalAudioHandlers } from './localAudio';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getFileHandle } from '@/shared/lib/storage/localFileHandleStorage';
import type { MessageResponse } from '@/entities/message';
import type { LocalAudioStateResponse } from '@/entities/dictionary';

jest.mock('@/shared/lib/storage/localFileHandleStorage', () => ({
  getFileHandle: jest.fn(),
}));

const mockGetFileHandle = jest.mocked(getFileHandle);

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
