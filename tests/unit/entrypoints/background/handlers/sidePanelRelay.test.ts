import { registerSidePanelRelayHandlers } from '@/entrypoints/background/handlers/sidePanelRelay';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { SetPlaybackRatePayloadSchema } from '@/entities/message/schema';
import type { BackgroundContext } from '@/entrypoints/background/context';
import type { MessageRequest, MessageResponse } from '@/entities/message';
import { sendTabMessage, queryTabs } from '@/shared/lib/chrome-apis';

jest.mock('@/shared/lib/chrome-apis', () => ({
  openSidePanel: jest.fn(),
  closeSidePanel: jest.fn(),
  sendMessage: jest.fn(),
  queryTabs: jest.fn(),
  sendTabMessage: jest.fn(),
  getTab: jest.fn(),
}));

jest.mock('@/entrypoints/background/helpers', () => ({
  updateBadgeForTab: jest.fn(),
  clearSessionMedia: jest.fn(),
}));

const mockedSendTabMessage = sendTabMessage as jest.MockedFunction<typeof sendTabMessage>;
const mockedQueryTabs = queryTabs as jest.MockedFunction<typeof queryTabs>;

function makeMockContext(): BackgroundContext {
  return {
    on: jest.fn(),
    activeTabIdForPanel: 7,
    networkInterceptor: {
      getLastPageUrl: jest.fn(),
      clearTab: jest.fn(),
      setLastPageUrl: jest.fn(),
    },
    lastCuesByTab: new Map(),
    autoDownloadedTabs: new Set(),
  } as unknown as BackgroundContext;
}

function getHandler(ctx: BackgroundContext, type: string) {
  const on = ctx.on as jest.Mock;
  const call = on.mock.calls.find(([t]) => t === type);
  if (!call) throw new Error(`${type} handler not registered`);
  return call[1] as (request: MessageRequest) => Promise<MessageResponse>;
}

describe('SetPlaybackRatePayloadSchema', () => {
  it('accepts allowed rates and rejects arbitrary numbers', () => {
    for (const rate of [0.5, 0.75, 1, 1.25, 1.5]) {
      expect(SetPlaybackRatePayloadSchema.safeParse({ rate }).success).toBe(true);
    }
    expect(SetPlaybackRatePayloadSchema.safeParse({ rate: 0.6 }).success).toBe(false);
    expect(SetPlaybackRatePayloadSchema.safeParse({ rate: 3 }).success).toBe(false);
    expect(SetPlaybackRatePayloadSchema.safeParse({ rate: '1.5' }).success).toBe(false);
    expect(SetPlaybackRatePayloadSchema.safeParse({}).success).toBe(false);
  });
});

describe('SET_PLAYBACK_RATE relay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedQueryTabs.mockResolvedValue([{ id: 42 } as chrome.tabs.Tab]);
    mockedSendTabMessage.mockResolvedValue(undefined);
  });

  it('relays a valid rate to the explicit tab', async () => {
    const ctx = makeMockContext();
    registerSidePanelRelayHandlers(ctx);
    const handler = getHandler(ctx, MESSAGE_TYPES.SET_PLAYBACK_RATE);

    const response = await handler({
      type: MESSAGE_TYPES.SET_PLAYBACK_RATE,
      payload: { tabId: 9, rate: 1.25 },
    });

    expect(response).toEqual({ success: true });
    expect(mockedSendTabMessage).toHaveBeenCalledWith(9, {
      type: MESSAGE_TYPES.SET_PLAYBACK_RATE,
      payload: { rate: 1.25 },
    });
    expect(mockedQueryTabs).not.toHaveBeenCalled();
  });

  it('resolves the active tab when tabId is omitted', async () => {
    const ctx = makeMockContext();
    registerSidePanelRelayHandlers(ctx);
    const handler = getHandler(ctx, MESSAGE_TYPES.SET_PLAYBACK_RATE);

    const response = await handler({
      type: MESSAGE_TYPES.SET_PLAYBACK_RATE,
      payload: { rate: 0.75 },
    });

    expect(response).toEqual({ success: true });
    expect(mockedQueryTabs).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(mockedSendTabMessage).toHaveBeenCalledWith(42, {
      type: MESSAGE_TYPES.SET_PLAYBACK_RATE,
      payload: { rate: 0.75 },
    });
  });

  it('rejects an invalid rate without relaying', async () => {
    const ctx = makeMockContext();
    registerSidePanelRelayHandlers(ctx);
    const handler = getHandler(ctx, MESSAGE_TYPES.SET_PLAYBACK_RATE);

    const response = await handler({
      type: MESSAGE_TYPES.SET_PLAYBACK_RATE,
      payload: { tabId: 9, rate: 2.4 },
    });

    expect(response.success).toBe(false);
    expect(mockedSendTabMessage).not.toHaveBeenCalled();
  });
});

describe('immersion tracker observe calls', () => {
  const makeTrackerCtx = (): { ctx: BackgroundContext; tracker: { noteTimeUpdate: jest.Mock; notePlayState: jest.Mock; closeTab: jest.Mock } } => {
    const tracker = { noteTimeUpdate: jest.fn(), notePlayState: jest.fn(), closeTab: jest.fn() };
    const ctx = { ...makeMockContext(), immersionTracker: tracker } as unknown as BackgroundContext;
    return { ctx, tracker };
  };

  it('observes VIDEO_TIME_UPDATE even when tab is not the panel tab', async () => {
    const { ctx, tracker } = makeTrackerCtx();
    registerSidePanelRelayHandlers(ctx);
    const handler = getHandler(ctx, MESSAGE_TYPES.VIDEO_TIME_UPDATE);
    const response = await handler({
      type: MESSAGE_TYPES.VIDEO_TIME_UPDATE,
      payload: { tabId: 99, currentTimeMs: 47293.333, durationMs: 362000.5 },
    });
    expect(response.success).toBe(true);
    expect(tracker.noteTimeUpdate).toHaveBeenCalledWith(99, 47293.333, undefined);
  });

  it('observes VIDEO_PLAY_STATE even when tab is not the panel tab', async () => {
    const { ctx, tracker } = makeTrackerCtx();
    registerSidePanelRelayHandlers(ctx);
    const handler = getHandler(ctx, MESSAGE_TYPES.VIDEO_PLAY_STATE);
    await handler({
      type: MESSAGE_TYPES.VIDEO_PLAY_STATE,
      payload: { tabId: 99, isPlaying: false },
    });
    expect(tracker.notePlayState).toHaveBeenCalledWith(99, false);
  });

  it('skips observe calls when tabId is undefined', async () => {
    const { ctx, tracker } = makeTrackerCtx();
    registerSidePanelRelayHandlers(ctx);
    const handler = getHandler(ctx, MESSAGE_TYPES.VIDEO_TIME_UPDATE);
    await handler({
      type: MESSAGE_TYPES.VIDEO_TIME_UPDATE,
      payload: { currentTimeMs: 1, durationMs: 2 },
    });
    expect(tracker.noteTimeUpdate).not.toHaveBeenCalled();
  });
});
