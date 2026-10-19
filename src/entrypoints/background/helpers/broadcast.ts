import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  queryTabs,
  sendMessageToAllFramesInTab,
} from '@/shared/lib/chrome-apis/tabs';
import type { BackgroundContext } from '../context';
import type { DetectedMediaUpdatePayload, MessageType } from '@/entities/message';
import type { DetectedVideo, DetectedSubtitle } from '@/entities/media';
import {
  saveSessionAutoDownloadedTabs,
  clearSessionMedia,
  saveSessionMedia,
  updateBadgeForTab,
} from '../helpers';

export async function sendMessageToAllTabs(
  message: { type: MessageType; payload: unknown },
  opts?: { excludeTabId?: number },
): Promise<void> {
  try {
    const tabs = await queryTabs({});
    await Promise.allSettled(
      tabs
        .filter((tab) => tab.id !== undefined && tab.id !== opts?.excludeTabId)
        .map((tab) => sendMessageToAllFramesInTab(tab.id!, message)),
    );
  } catch {}
}

export async function broadcastToAllContexts(
  ctx: BackgroundContext,
  message: { type: MessageType; payload: unknown },
): Promise<void> {
  try {
    ctx.messageBus.broadcast(message);
  } catch {}
  await sendMessageToAllTabs(message);
}

export function broadcastDetectedMedia(
  ctx: BackgroundContext,
  tabId: number,
  overrides?: { videos?: DetectedVideo[]; subtitles?: DetectedSubtitle[] },
): void {
  ctx.messageBus.broadcast({
    type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
    payload: {
      videos: overrides?.videos ?? ctx.networkInterceptor.getVideos(tabId),
      subtitles: overrides?.subtitles ?? ctx.networkInterceptor.getSubtitles(tabId),
      tabId,
    } satisfies DetectedMediaUpdatePayload,
  });
}

export function clearTabState(ctx: BackgroundContext, tabId: number): void {
  ctx.autoDownloadedTabs.delete(tabId);
  saveSessionAutoDownloadedTabs(ctx);
  ctx.networkInterceptor.clearTab(tabId);
  clearSessionMedia(ctx, tabId);
  ctx.lastCuesByTab.delete(tabId);
  ctx.immersionTracker?.closeTab(tabId);
  updateBadgeForTab(ctx, tabId);
}

// (ADR-123) nav clears run after detection of the next episode has already
// landed — keep subtitles detected inside the nav window.
const NAV_FRESH_SUBTITLE_WINDOW_MS = 5000;

export function clearTabStateKeepingFreshSubtitles(
  ctx: BackgroundContext,
  tabId: number,
  sinceMs: number,
): void {
  const freshSubtitles = ctx.networkInterceptor
    .getSubtitles(tabId)
    .filter((s) => s.detectedAt >= sinceMs - NAV_FRESH_SUBTITLE_WINDOW_MS);
  clearTabState(ctx, tabId);
  if (freshSubtitles.length > 0) {
    ctx.networkInterceptor.addDetectedSubtitles(freshSubtitles);
    saveSessionMedia(ctx, tabId, ctx.networkInterceptor.getVideos(tabId), freshSubtitles);
    broadcastDetectedMedia(ctx, tabId);
  }
}

export async function openExtensionTab(
  path: string,
  params?: Record<string, string>,
): Promise<number | undefined> {
  let url = chrome.runtime.getURL(path);
  const qs = new URLSearchParams(params).toString();
  if (qs) url += `?${qs}`;
  const tab = await chrome.tabs.create({ url });
  return tab.id;
}
