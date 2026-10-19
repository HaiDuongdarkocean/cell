import { registerSidePanelRelayHandlers } from './sidePanelRelay';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessageToAllFramesInTab } from '@/shared/lib/chrome-apis';
import { saveSessionMedia } from '../helpers';
import { broadcastDetectedMedia } from '../helpers/broadcast';

jest.mock('@/shared/lib/chrome-apis', () => ({
  openSidePanel: jest.fn(),
  closeSidePanel: jest.fn(),
  sendMessage: jest.fn(),
  queryTabs: jest.fn(),
  sendTabMessage: jest.fn(),
  sendMessageToAllFramesInTab: jest.fn().mockResolvedValue(undefined),
  getTab: jest.fn(),
}));

jest.mock('../helpers', () => ({
  updateBadgeForTab: jest.fn(),
  clearSessionMedia: jest.fn(),
  saveSessionMedia: jest.fn(),
}));

jest.mock('../helpers/broadcast', () => ({
  broadcastDetectedMedia: jest.fn(),
}));

function createMockCtx(subtitles: { detectedAt: number }[] = []) {
  const handlers = new Map<string, (request: { payload: unknown }) => Promise<unknown>>();
  return {
    handlers,
    on: (type: string, handler: (request: { payload: unknown }) => Promise<unknown>) => {
      handlers.set(type, handler);
    },
    networkInterceptor: {
      clearTab: jest.fn(),
      getLastPageUrl: jest.fn().mockReturnValue(undefined),
      setLastPageUrl: jest.fn(),
      getVideos: jest.fn().mockReturnValue([]),
      getSubtitles: jest.fn().mockReturnValue(subtitles),
      addDetectedSubtitles: jest.fn().mockReturnValue(subtitles.length),
    },
    autoDownloadedTabs: new Set<number>(),
    lastCuesByTab: new Map(),
    messageBus: { broadcast: jest.fn() },
  };
}

type Ctx = ReturnType<typeof createMockCtx>;

function register(ctx: Ctx) {
  registerSidePanelRelayHandlers(ctx as unknown as Parameters<typeof registerSidePanelRelayHandlers>[0]);
  return ctx.handlers.get(MESSAGE_TYPES.VIDEO_EPISODE_CHANGED)!;
}

describe('VIDEO_EPISODE_CHANGED', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wipes media and pushes a null AUTO_LOAD when no fresh subtitles exist', async () => {
    const ctx = createMockCtx([{ detectedAt: 1_000 }]);
    const handler = register(ctx);
    await handler({ payload: { tabId: 7, pageUrl: 'https://player.example/ep2.mp4', episodeAt: 100_000 } });
    expect(ctx.networkInterceptor.clearTab).toHaveBeenCalledWith(7);
    expect(ctx.networkInterceptor.addDetectedSubtitles).not.toHaveBeenCalled();
    expect(sendMessageToAllFramesInTab).toHaveBeenCalledWith(7, expect.objectContaining({
      type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
      payload: expect.objectContaining({ target: null, native: null }),
    }));
  });

  it('keeps subtitles detected inside the switch window and skips the null push', async () => {
    const fresh = [{ detectedAt: 100_000 - 1_000 }, { detectedAt: 100_000 - 4_999 }];
    const ctx = createMockCtx(fresh);
    const handler = register(ctx);
    await handler({ payload: { tabId: 7, pageUrl: 'https://googlevideo.example/play?id=x', episodeAt: 100_000 } });
    expect(ctx.networkInterceptor.clearTab).toHaveBeenCalledWith(7);
    expect(ctx.networkInterceptor.addDetectedSubtitles).toHaveBeenCalledWith(fresh);
    expect(saveSessionMedia).toHaveBeenCalled();
    expect(broadcastDetectedMedia).toHaveBeenCalled();
    expect(sendMessageToAllFramesInTab).not.toHaveBeenCalled();
  });

  it('still wipes when episodeAt is absent (legacy payload)', async () => {
    const ctx = createMockCtx([{ detectedAt: Date.now() }]);
    const handler = register(ctx);
    await handler({ payload: { tabId: 7, pageUrl: 'https://player.example/ep2.mp4' } });
    expect(ctx.networkInterceptor.addDetectedSubtitles).not.toHaveBeenCalled();
    expect(sendMessageToAllFramesInTab).toHaveBeenCalled();
  });
});
