import { registerDetectionDispatchHandlers } from './detectionDispatch';
import { MESSAGE_TYPES } from '@/shared/config/messages';

jest.mock('../helpers', () => ({
  getActiveTabId: jest.fn().mockResolvedValue(7),
  updateBadgeForTab: jest.fn(),
  pushAutoLoadSubtitles: jest.fn().mockResolvedValue(undefined),
  saveSessionAutoDownloadedTabs: jest.fn(),
}));

jest.mock('@/shared/lib/chrome-apis', () => ({
  sendTabMessage: jest.fn().mockResolvedValue(undefined),
}));

function createMockCtx() {
  const handlers = new Map<string, (request: { payload: unknown }) => Promise<unknown>>();
  return {
    handlers,
    on: (type: string, handler: (request: { payload: unknown }) => Promise<unknown>) => {
      handlers.set(type, handler);
    },
    networkInterceptor: {
      clearTab: jest.fn(),
      getVideos: jest.fn().mockReturnValue([]),
      getSubtitles: jest.fn().mockReturnValue([]),
      addDetectedSubtitles: jest.fn().mockReturnValue(1),
    },
    autoDownloadedTabs: new Set<number>(),
    lastCuesByTab: new Map(),
    messageBus: { broadcast: jest.fn() },
  };
}

type Ctx = ReturnType<typeof createMockCtx>;

function register(ctx: Ctx) {
  registerDetectionDispatchHandlers(ctx as unknown as Parameters<typeof registerDetectionDispatchHandlers>[0]);
  return ctx.handlers.get(MESSAGE_TYPES.DETECTED_SUBTITLES)!;
}

const ytTrack = {
  baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en',
  languageCode: 'en',
  name: { simpleText: 'English', runs: [{ text: 'English' }] },
  vssId: '.en',
};

const iqTrack = {
  _name: 'English',
  lid: 3,
  ss: 0,
  srt: '/20260115/6c/7b/c112.srt?qyb=1',
  extra: 'stripped',
};

const nfTrack = {
  trackId: 'T:2:0;1;vi;0;0;0;',
  bcp47: 'vi',
  displayName: 'Vietnamese',
  rawTrackType: 'SUBTITLES',
  isNoneTrack: false,
  isForcedNarrative: false,
  isImageBased: false,
  url: 'https://cdn.netflix.com/x.vtt',
};

describe('DETECTED_SUBTITLES dispatch', () => {
  it('rejects a malformed envelope (non-array tracks)', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({ payload: { tabId: 1, tracks: 'nope' } });
    expect(res).toEqual(expect.objectContaining({ success: false }));
    expect(ctx.networkInterceptor.addDetectedSubtitles).not.toHaveBeenCalled();
  });

  it('maps YouTube tracks when source is absent (backward compat)', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({ payload: { tabId: 1, tracks: [ytTrack] } });
    expect(res).toEqual({ success: true });
    expect(ctx.networkInterceptor.addDetectedSubtitles).toHaveBeenCalledWith([
      expect.objectContaining({ format: 'vtt', language: 'en', tabId: 1 }),
    ]);
  });

  it('maps iQIYI tracks (extra producer keys stripped)', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({
      payload: { tabId: 1, source: 'iqiyi', tracks: [iqTrack], origin: 'https://x.iq.com' },
    });
    expect(res).toEqual({ success: true });
    expect(ctx.networkInterceptor.addDetectedSubtitles).toHaveBeenCalled();
  });

  it('maps Netflix tracks', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({ payload: { tabId: 1, source: 'netflix', tracks: [nfTrack] } });
    expect(res).toEqual({ success: true });
    expect(ctx.networkInterceptor.addDetectedSubtitles).toHaveBeenCalledWith([
      expect.objectContaining({ language: 'vi', tabId: 1 }),
    ]);
  });

  it('rejects malformed tracks without reaching the mapper', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({
      payload: { tabId: 1, source: 'netflix', tracks: [{ trackId: 'x' }] },
    });
    expect(res).toEqual(expect.objectContaining({ success: false }));
    expect(ctx.networkInterceptor.addDetectedSubtitles).not.toHaveBeenCalled();
  });

  it('fails closed on unknown source strings', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({ payload: { tabId: 1, source: 'vimeo', tracks: [ytTrack] } });
    expect(res).toEqual(expect.objectContaining({ success: false }));
  });

  it('still runs the overlay-clear path on a valid empty tracks array', async () => {
    const ctx = createMockCtx();
    const handler = register(ctx);
    const res = await handler({ payload: { tabId: 1, tracks: [] } });
    expect(res).toEqual({ success: true });
    expect(ctx.networkInterceptor.clearTab).toHaveBeenCalledWith(1);
    expect(ctx.messageBus.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE }),
    );
  });
});
