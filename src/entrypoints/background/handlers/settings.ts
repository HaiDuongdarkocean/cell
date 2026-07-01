/**
 * Settings message handlers — GET_SETTINGS, UPDATE_SETTINGS,
 * GET_EXTENSION_STATUS, TOGGLE_EXTENSION.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import {
  loadSettings,
  saveSettings,
  saveExtensionStatus,
  updateBadgeForActiveTab,
  reloadActiveTab,
  clearBadge,
} from '../helpers';
import type { Settings } from '@/entities/media';
import type {
  MessageResponse,
  UpdateSettingsPayload,
} from '@/entities/message';

/** Register settings message handlers. */
export function registerSettingsHandlers(ctx: BackgroundContext): void {
  // GET_SETTINGS: return persisted settings (or defaults).
  ctx.on(MESSAGE_TYPES.GET_SETTINGS, async (): Promise<MessageResponse<Settings>> => {
    const settings = await loadSettings();
    return { success: true, data: settings };
  });

  // UPDATE_SETTINGS: persist settings and apply to the download queue.
  ctx.on(MESSAGE_TYPES.UPDATE_SETTINGS, async (request): Promise<MessageResponse<Settings>> => {
    const payload = request.payload as UpdateSettingsPayload;
    const current = await loadSettings();
    const merged: Settings = { ...current, ...payload.settings };

    await saveSettings(ctx, merged);

    if (payload.settings.concurrentDownloads !== undefined) {
      ctx.downloadQueue.setMaxConcurrent(payload.settings.concurrentDownloads);
    }
    if (payload.settings.convertToMp4 !== undefined) {
      ctx.downloader.setConvertMode(payload.settings.convertToMp4);
    }
    if (payload.settings.segmentConcurrency !== undefined) {
      ctx.downloader.setSegmentConcurrency(payload.settings.segmentConcurrency);
    }
    if (payload.settings.filenameSource !== undefined) {
      ctx.downloader.setFilenameSource(payload.settings.filenameSource);
    }
    if (
      payload.settings.parallelConversion !== undefined ||
      payload.settings.manualWorkerCount !== undefined
    ) {
      ctx.downloader.setParallelSettings({
        parallelConversion: merged.parallelConversion,
        manualWorkerCount: merged.manualWorkerCount,
      });
    }
    // parallelFallback is read by the offscreen conversion path when a
    // conversion starts; no immediate side-effect to apply here.

    return { success: true, data: merged };
  });

  // GET_EXTENSION_STATUS: return the active state.
  ctx.on(MESSAGE_TYPES.GET_EXTENSION_STATUS, async (): Promise<MessageResponse<{ active: boolean }>> => {
    return { success: true, data: { active: ctx.extensionActive } };
  });

  // TOGGLE_EXTENSION: toggle, persist, and start/stop the interceptor.
  ctx.on(MESSAGE_TYPES.TOGGLE_EXTENSION, async (): Promise<MessageResponse<{ active: boolean }>> => {
    ctx.extensionActive = !ctx.extensionActive;
    await saveExtensionStatus(ctx, ctx.extensionActive);

    if (ctx.extensionActive) {
      ctx.networkInterceptor.start();
      void updateBadgeForActiveTab(ctx);
      await reloadActiveTab(ctx);
    } else {
      ctx.networkInterceptor.stop();
      clearBadge(ctx);
    }

    return { success: true, data: { active: ctx.extensionActive } };
  });
}
