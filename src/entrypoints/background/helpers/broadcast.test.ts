jest.mock('@/shared/lib/chrome-apis/tabs', () => ({
  queryTabs: jest.fn(),
  sendMessageToAllFramesInTab: jest.fn(),
}));
jest.mock('../helpers', () => ({
  saveSessionAutoDownloadedTabs: jest.fn(),
  clearSessionMedia: jest.fn(),
  updateBadgeForTab: jest.fn(),
}));
jest.mock('@/shared/config/messages', () => ({
  MESSAGE_TYPES: { DETECTED_MEDIA_UPDATE: 'DETECTED_MEDIA_UPDATE' },
}));

import { queryTabs, sendMessageToAllFramesInTab } from '@/shared/lib/chrome-apis/tabs';
import { saveSessionAutoDownloadedTabs, clearSessionMedia, updateBadgeForTab } from '../helpers';
import { sendMessageToAllTabs, broadcastDetectedMedia, clearTabState } from './broadcast';
import type { BackgroundContext } from '../context';

const queryTabsMock = queryTabs as jest.MockedFunction<typeof queryTabs>;
const sendAllMock = sendMessageToAllFramesInTab as jest.MockedFunction<typeof sendMessageToAllFramesInTab>;

const makeCtx = () =>
  ({
    autoDownloadedTabs: new Set([5]),
    lastCuesByTab: new Map([[5, []]]),
    immersionTracker: { closeTab: jest.fn() },
    networkInterceptor: {
      getVideos: jest.fn().mockReturnValue([{ id: 'v1' }]),
      getSubtitles: jest.fn().mockReturnValue([{ id: 's1' }]),
      clearTab: jest.fn(),
    },
    messageBus: { broadcast: jest.fn() },
  }) as unknown as BackgroundContext;

beforeEach(() => {
  jest.clearAllMocks();
});

test('sendMessageToAllTabs sends to every tab with an id', async () => {
  queryTabsMock.mockResolvedValue([
    { id: 1 },
    { id: 2 },
    { id: undefined },
  ] as chrome.tabs.Tab[]);
  await sendMessageToAllTabs({ type: 'X', payload: {} });
  expect(sendAllMock).toHaveBeenCalledTimes(2);
  expect(sendAllMock).toHaveBeenCalledWith(1, { type: 'X', payload: {} });
  expect(sendAllMock).toHaveBeenCalledWith(2, { type: 'X', payload: {} });
});

test('sendMessageToAllTabs respects excludeTabId and swallows send failures', async () => {
  queryTabsMock.mockResolvedValue([{ id: 1 }, { id: 2 }] as chrome.tabs.Tab[]);
  sendAllMock.mockRejectedValue(new Error('no receiver'));
  await expect(
    sendMessageToAllTabs({ type: 'X', payload: null }, { excludeTabId: 1 }),
  ).resolves.toBeUndefined();
  expect(sendAllMock).toHaveBeenCalledTimes(1);
  expect(sendAllMock).toHaveBeenCalledWith(2, { type: 'X', payload: null });
});

test('sendMessageToAllTabs swallows query failure', async () => {
  queryTabsMock.mockRejectedValue(new Error('denied'));
  await expect(sendMessageToAllTabs({ type: 'X', payload: null })).resolves.toBeUndefined();
});

test('broadcastDetectedMedia reads videos+subtitles for the tab', () => {
  const ctx = makeCtx();
  broadcastDetectedMedia(ctx, 7);
  expect(ctx.networkInterceptor.getVideos).toHaveBeenCalledWith(7);
  expect(ctx.messageBus.broadcast).toHaveBeenCalledWith({
    type: 'DETECTED_MEDIA_UPDATE',
    payload: { videos: [{ id: 'v1' }], subtitles: [{ id: 's1' }], tabId: 7 },
  });
});

test('broadcastDetectedMedia uses overrides when given', () => {
  const ctx = makeCtx();
  broadcastDetectedMedia(ctx, 7, { videos: [], subtitles: [] });
  expect(ctx.networkInterceptor.getVideos).not.toHaveBeenCalled();
  expect(ctx.messageBus.broadcast).toHaveBeenCalledWith({
    type: 'DETECTED_MEDIA_UPDATE',
    payload: { videos: [], subtitles: [], tabId: 7 },
  });
});

test('clearTabState clears every per-tab structure', () => {
  const ctx = makeCtx();
  clearTabState(ctx, 5);
  expect(ctx.autoDownloadedTabs.has(5)).toBe(false);
  expect(saveSessionAutoDownloadedTabs).toHaveBeenCalledWith(ctx);
  expect(ctx.networkInterceptor.clearTab).toHaveBeenCalledWith(5);
  expect(clearSessionMedia).toHaveBeenCalledWith(ctx, 5);
  expect(ctx.lastCuesByTab.has(5)).toBe(false);
  expect(ctx.immersionTracker!.closeTab).toHaveBeenCalledWith(5);
  expect(updateBadgeForTab).toHaveBeenCalledWith(ctx, 5);
});

test('clearTabState tolerates missing immersionTracker', () => {
  const ctx = makeCtx();
  delete (ctx as { immersionTracker?: unknown }).immersionTracker;
  expect(() => clearTabState(ctx, 5)).not.toThrow();
});
