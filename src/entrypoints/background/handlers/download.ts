/**
 * Download message handlers — DOWNLOAD_VIDEO, DOWNLOAD_SUBTITLE, DOWNLOAD_ALL,
 * CANCEL, PAUSE, RESUME, RETRY, REMOVE, GET_DOWNLOAD_PROGRESS, CONVERSION_PROGRESS_UPDATE.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import {
  findVideoById,
  findSubtitleById,
  createDownloadItem,
  getActiveTabId,
} from '../helpers';
import type {
  DownloadItem,
  DownloadProgress,
} from '@/entities/media';
import type {
  MessageResponse,
  DownloadListResponse,
  DownloadProgressUpdatePayload,
} from '@/entities/message';
import {
  DownloadVideoPayloadSchema,
  DownloadSubtitlePayloadSchema,
  DownloadAllPayloadSchema,
  CancelDownloadPayloadSchema,
  GetDownloadProgressPayloadSchema,
  ConversionProgressUpdatePayloadSchema,
} from '@/entities/message/schema';

/** Register all download-related message handlers on the context's messageBus. */
export function registerDownloadHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.DOWNLOAD_VIDEO, async (request): Promise<MessageResponse<DownloadItem>> => {
    const parsed = DownloadVideoPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid DOWNLOAD_VIDEO payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const video = await findVideoById(ctx, payload.videoId);

    if (!video) {
      return { success: false, error: `Video not found: ${payload.videoId}` };
    }

    const item = createDownloadItem(ctx, video, 'video');
    ctx.downloadQueue.add(item);

    return { success: true, data: item };
  });

  ctx.on(MESSAGE_TYPES.DOWNLOAD_SUBTITLE, async (request): Promise<MessageResponse<DownloadItem>> => {
    const parsed = DownloadSubtitlePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid DOWNLOAD_SUBTITLE payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const subtitle = await findSubtitleById(ctx, payload.subtitleId);

    if (!subtitle) {
      console.error(
        `[background] Subtitle not found: ${payload.subtitleId}`,
      );
      return {
        success: false,
        error: `Subtitle not found: ${payload.subtitleId}`,
      };
    }

    const item = createDownloadItem(ctx, subtitle, 'subtitle');
    ctx.downloadQueue.add(item);

    return { success: true, data: item };
  });

  ctx.on(MESSAGE_TYPES.DOWNLOAD_ALL, async (request): Promise<MessageResponse<DownloadListResponse>> => {
    const parsed = DownloadAllPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid DOWNLOAD_ALL payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const tabId = payload.tabId ?? (await getActiveTabId(ctx));

    if (tabId === undefined) {
      return { success: false, error: 'No active tab found' };
    }

    const { videos, subtitles } = ctx.networkInterceptor.getMedia(tabId);

    if (videos.length === 0 && subtitles.length === 0) {
      return { success: false, error: 'No media found for this tab' };
    }

    const items: DownloadItem[] = [];

    for (const video of videos) {
      items.push(createDownloadItem(ctx, video, 'video'));
    }
    for (const subtitle of subtitles) {
      items.push(createDownloadItem(ctx, subtitle, 'subtitle'));
    }

    ctx.downloadQueue.addAll(items);

    return { success: true, data: { downloads: items } };
  });

  ctx.on(MESSAGE_TYPES.CANCEL_DOWNLOAD, async (request): Promise<MessageResponse> => {
    const parsed = CancelDownloadPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid CANCEL_DOWNLOAD payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    ctx.downloadQueue.cancel(payload.downloadId);
    ctx.downloader.cancel(payload.downloadId);
    return { success: true };
  });

  ctx.on(MESSAGE_TYPES.PAUSE_DOWNLOAD, async (request): Promise<MessageResponse> => {
    const parsed = CancelDownloadPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid PAUSE_DOWNLOAD payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    ctx.downloader.pause(payload.downloadId);
    ctx.downloadQueue.pause(payload.downloadId);
    return { success: true };
  });

  ctx.on(MESSAGE_TYPES.RESUME_DOWNLOAD, async (request): Promise<MessageResponse> => {
    const parsed = CancelDownloadPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid RESUME_DOWNLOAD payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    ctx.downloadQueue.resume(payload.downloadId);
    ctx.downloader.resume(payload.downloadId);
    return { success: true };
  });

  ctx.on(MESSAGE_TYPES.RETRY_DOWNLOAD, async (request): Promise<MessageResponse> => {
    const parsed = CancelDownloadPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid RETRY_DOWNLOAD payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    ctx.downloader.retry(payload.downloadId);
    ctx.downloadQueue.retry(payload.downloadId);
    return { success: true };
  });

  ctx.on(MESSAGE_TYPES.REMOVE_DOWNLOAD, async (request): Promise<MessageResponse> => {
    const parsed = CancelDownloadPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid REMOVE_DOWNLOAD payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const item = ctx.downloadQueue.getById(payload.downloadId);
    if (item && (item.status === 'downloading' || item.status === 'converting')) {
      ctx.downloader.cancel(payload.downloadId);
    }
    ctx.downloadQueue.remove(payload.downloadId);
    return { success: true };
  });

  ctx.on(MESSAGE_TYPES.GET_DOWNLOAD_PROGRESS, async (request): Promise<MessageResponse<DownloadListResponse>> => {
    await ctx.sessionReady;
    const parsed = GetDownloadProgressPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid GET_DOWNLOAD_PROGRESS payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;
    const downloads =
      payload?.tabId !== undefined
        ? ctx.downloadQueue.getByTab(payload.tabId)
        : ctx.downloadQueue.getAll();
    return { success: true, data: { downloads } };
  });

  ctx.on(MESSAGE_TYPES.CONVERSION_PROGRESS_UPDATE, async (request): Promise<MessageResponse> => {
    const parsed = ConversionProgressUpdatePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid CONVERSION_PROGRESS_UPDATE payload: ${parsed.error.message}` };
    }
    const payload = parsed.data;

    const progress: DownloadProgress = {
      itemId: payload.downloadId,
      status: 'converting',
      progress: payload.percent,
      fileSize: payload.fileSize,
      processedBytes: payload.processedBytes,
      conversionPhase: payload.phase,
      workerCount: payload.workerCount,
      usedWorkers: payload.usedWorkers,
      downloadProgress: 100,
      convertProgress: payload.percent,
    };

    ctx.downloadQueue.updateProgress(progress);

    const item = ctx.downloadQueue.getById(payload.downloadId);
    ctx.messageBus.broadcast({
      type: MESSAGE_TYPES.DOWNLOAD_PROGRESS_UPDATE,
      payload: {
        progress,
        tabId: item?.tabId ?? 0,
      } satisfies DownloadProgressUpdatePayload,
    });

    return { success: true };
  });
}
