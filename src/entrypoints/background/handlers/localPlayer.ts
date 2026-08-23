/**
 * Local Player message handlers — OPEN_LOCAL_PLAYER, SAVE_RESUME_POSITION,
 * GET_RESUME_POSITION, GET_HISTORY, SAVE_HISTORY, GET_LIBRARY,
 * LOCAL_PLAYER_VIDEO_OPENED.
 *
 * These handlers run in the background service worker and delegate to
 * `mediaLibraryRepository` (T9) for IndexedDB persistence. The player page
 * itself (local-player/main.tsx) also calls the repository directly since it
 * runs in the same extension origin and has IndexedDB access — these handlers
 * exist for cross-context messages (e.g. popup → background → open player).
 *
 * @source chrome.tabs.create — https://developer.chrome.com/docs/extensions/reference/api/tabs#method-create
 * @source chrome.runtime.getURL — https://developer.chrome.com/docs/extensions/reference/api/runtime#method-getURL
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  OpenLocalPlayerPayload,
  SaveResumePositionPayload,
  GetResumePositionPayload,
  GetResumePositionResult,
  GetHistoryResult,
  SaveHistoryPayload,
  GetLibraryResult,
  LocalPlayerVideoOpenedPayload,
} from '@/entities/message';
import {
  saveVideo,
  getVideo,
  getAllVideos,
  updateResumePosition,
  addHistoryEntry,
  getHistory,
  type VideoRecord,
} from '@/features/local-player/services/mediaLibraryRepository';

/** Path to the local player HTML page (matches web_accessible_resources). */
const LOCAL_PLAYER_PATH = 'src/entrypoints/local-player/index.html';

/** Register local player message handlers on the background context. */
export function registerLocalPlayerHandlers(ctx: BackgroundContext): void {
  // OPEN_LOCAL_PLAYER — open the player page in a new tab.
  // @source chrome.tabs.create — https://developer.chrome.com/docs/extensions/reference/api/tabs#method-create
  ctx.on(
    MESSAGE_TYPES.OPEN_LOCAL_PLAYER,
    async (request): Promise<MessageResponse<{ tabId: number }>> => {
      const payload = request.payload as OpenLocalPlayerPayload | undefined;
      const url = chrome.runtime.getURL(LOCAL_PLAYER_PATH);
      const fullUrl = payload?.videoId
        ? `${url}?videoId=${encodeURIComponent(payload.videoId)}`
        : url;
      const tab = await chrome.tabs.create({ url: fullUrl });
      if (tab.id === undefined) {
        return { success: false, error: 'Failed to create tab' };
      }
      return { success: true, data: { tabId: tab.id } };
    },
  );

  // SAVE_RESUME_POSITION — update resume position + lastWatchedAt.
  ctx.on(
    MESSAGE_TYPES.SAVE_RESUME_POSITION,
    async (request): Promise<MessageResponse> => {
      const payload = request.payload as SaveResumePositionPayload | undefined;
      if (!payload?.videoId) {
        return { success: false, error: 'Missing videoId' };
      }
      await updateResumePosition(
        payload.videoId,
        payload.timeMs,
        new Date().toISOString(),
      );
      return { success: true };
    },
  );

  // GET_RESUME_POSITION — retrieve saved resume position for a video.
  ctx.on(
    MESSAGE_TYPES.GET_RESUME_POSITION,
    async (request): Promise<MessageResponse<GetResumePositionResult>> => {
      const payload = request.payload as GetResumePositionPayload | undefined;
      if (!payload?.videoId) {
        return { success: false, error: 'Missing videoId' };
      }
      const video = await getVideo(payload.videoId);
      if (!video) {
        return {
          success: true,
          data: {
            resumePositionMs: null,
            durationMs: null,
            lastWatchedAt: null,
          },
        };
      }
      return {
        success: true,
        data: {
          resumePositionMs: video.resumePositionMs,
          durationMs: video.durationMs,
          lastWatchedAt: video.lastWatchedAt
            ? Date.parse(video.lastWatchedAt) || null
            : null,
        },
      };
    },
  );

  // GET_HISTORY — return all history entries (sorted by watchedAt desc).
  ctx.on(
    MESSAGE_TYPES.GET_HISTORY,
    async (): Promise<MessageResponse<GetHistoryResult>> => {
      const history = await getHistory();
      return { success: true, data: { history } };
    },
  );

  // SAVE_HISTORY — add a history entry.
  ctx.on(
    MESSAGE_TYPES.SAVE_HISTORY,
    async (request): Promise<MessageResponse> => {
      const payload = request.payload as SaveHistoryPayload | undefined;
      if (!payload?.videoId) {
        return { success: false, error: 'Missing videoId' };
      }
      await addHistoryEntry({
        id: `${payload.videoId}-${payload.watchedAt}`,
        videoId: payload.videoId,
        watchedAt: new Date(payload.watchedAt).toISOString(),
        watchDurationMs: payload.durationWatchedMs,
        positionMs: 0,
      });
      return { success: true };
    },
  );

  // GET_LIBRARY — return all library videos.
  ctx.on(
    MESSAGE_TYPES.GET_LIBRARY,
    async (): Promise<MessageResponse<GetLibraryResult>> => {
      const videos = await getAllVideos();
      return { success: true, data: { videos } };
    },
  );

  // LOCAL_PLAYER_VIDEO_OPENED — upsert library entry + add history open event.
  ctx.on(
    MESSAGE_TYPES.LOCAL_PLAYER_VIDEO_OPENED,
    async (request): Promise<MessageResponse> => {
      const payload = request.payload as
        | LocalPlayerVideoOpenedPayload
        | undefined;
      if (!payload?.videoId) {
        return { success: false, error: 'Missing videoId' };
      }
      const now = new Date().toISOString();
      const record: VideoRecord = {
        id: payload.videoId,
        filename: payload.filename,
        title: payload.title,
        durationMs: payload.durationMs,
        addedAt: now,
        lastWatchedAt: now,
        resumePositionMs: 0,
      };
      await saveVideo(record);
      await addHistoryEntry({
        id: `${payload.videoId}-${Date.now()}`,
        videoId: payload.videoId,
        watchedAt: now,
        watchDurationMs: 0,
        positionMs: 0,
      });
      return { success: true };
    },
  );
}
