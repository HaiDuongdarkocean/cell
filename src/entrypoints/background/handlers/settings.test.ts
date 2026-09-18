import { registerSettingsHandlers } from './settings';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { loadSettings, saveSettings } from '../helpers';
import { DEFAULT_SETTINGS } from '@/shared/config/config';

jest.mock('../helpers', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn().mockResolvedValue(undefined),
  saveExtensionStatus: jest.fn().mockResolvedValue(undefined),
  updateBadgeForActiveTab: jest.fn(),
  reloadActiveTab: jest.fn().mockResolvedValue(undefined),
  clearBadge: jest.fn(),
}));

function createMockCtx() {
  const handlers = new Map<string, (request: { payload: unknown }) => Promise<unknown>>();
  return {
    handlers,
    on: (type: string, handler: (request: { payload: unknown }) => Promise<unknown>) => {
      handlers.set(type, handler);
    },
    downloadQueue: { setMaxConcurrent: jest.fn() },
    downloader: {
      setConvertMode: jest.fn(),
      setSegmentConcurrency: jest.fn(),
      setFilenameSource: jest.fn(),
    },
  };
}

type Ctx = ReturnType<typeof createMockCtx>;

function register(ctx: Ctx) {
  registerSettingsHandlers(ctx as unknown as Parameters<typeof registerSettingsHandlers>[0]);
  return ctx.handlers.get(MESSAGE_TYPES.UPDATE_SETTINGS)!;
}

describe('UPDATE_SETTINGS patch sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadSettings as jest.Mock).mockResolvedValue({ ...DEFAULT_SETTINGS });
  });

  it('merges a valid patch and fires eager setters', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({
      payload: { settings: { concurrentDownloads: 5, convertToMp4: 'never' } },
    });
    expect(res).toEqual(expect.objectContaining({ success: true }));
    expect(saveSettings).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ concurrentDownloads: 5, convertToMp4: 'never' }),
    );
    expect(ctx.downloadQueue.setMaxConcurrent).toHaveBeenCalledWith(5);
    expect(ctx.downloader.setConvertMode).toHaveBeenCalledWith('never');
  });

  it('drops unknown + mistyped + bad-enum + schemaVersion keys before save', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    await handler({
      payload: {
        settings: {
          notAKey: 1,
          concurrentDownloads: 'lots',
          convertToMp4: 'bogus',
          schemaVersion: 1,
          uiLanguage: 'vi',
        },
      },
    });
    const saved = (saveSettings as jest.Mock).mock.calls[0][1];
    expect(saved).not.toHaveProperty('notAKey');
    expect(saved).not.toHaveProperty('schemaVersion');
    expect(saved.concurrentDownloads).toBe(DEFAULT_SETTINGS.concurrentDownloads);
    expect(saved.convertToMp4).toBe(DEFAULT_SETTINGS.convertToMp4);
    expect(saved.uiLanguage).toBe('vi');
    expect(ctx.downloadQueue.setMaxConcurrent).not.toHaveBeenCalled();
    expect(ctx.downloader.setConvertMode).not.toHaveBeenCalled();
  });

  it('accepts an activeProfileId string patch (null default)', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    await handler({ payload: { settings: { activeProfileId: 'prof-1' } } });
    expect((saveSettings as jest.Mock).mock.calls[0][1].activeProfileId).toBe('prof-1');
  });

  it('rejects a non-record settings payload at the envelope', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({ payload: { settings: [1, 2] } });
    expect(res).toEqual(expect.objectContaining({ success: false }));
    expect(saveSettings).not.toHaveBeenCalled();
  });
});
