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
import type { MessageResponse } from '@/entities/message';
import { EmptyPayloadSchema, UpdateSettingsPayloadSchema } from '@/entities/message/schema';
import { sanitizeSettingsPatch } from '@/entities/settings/settingsPatch';

/** Register settings message handlers. */
export function registerSettingsHandlers(ctx: BackgroundContext): void {
  // GET_SETTINGS: return persisted settings (or defaults).
  ctx.on(MESSAGE_TYPES.GET_SETTINGS, async (request): Promise<MessageResponse<Settings>> => {
    const parsed = EmptyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid GET_SETTINGS payload: ${parsed.error.message}` };
    }
    const settings = await loadSettings();
    return { success: true, data: settings };
  });

  // UPDATE_SETTINGS: persist settings and apply to the download queue.
  ctx.on(MESSAGE_TYPES.UPDATE_SETTINGS, async (request): Promise<MessageResponse<Settings>> => {
    const parsed = UpdateSettingsPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid UPDATE_SETTINGS payload: ${parsed.error.message}` };
    }
    const patch = sanitizeSettingsPatch(parsed.data.settings);
    const current = await loadSettings();
    const merged: Settings = { ...current, ...patch };

    await saveSettings(ctx, merged);

    if (patch.concurrentDownloads !== undefined) {
      ctx.downloadQueue.setMaxConcurrent(patch.concurrentDownloads);
    }
    if (patch.convertToMp4 !== undefined) {
      ctx.downloader.setConvertMode(patch.convertToMp4);
    }
    if (patch.segmentConcurrency !== undefined) {
      ctx.downloader.setSegmentConcurrency(patch.segmentConcurrency);
    }
    if (patch.filenameSource !== undefined) {
      ctx.downloader.setFilenameSource(patch.filenameSource);
    }
    // parallelFallback is read by the offscreen conversion path when a
    // conversion starts; no immediate side-effect to apply here.

    return { success: true, data: merged };
  });

  // GET_EXTENSION_STATUS: return the active state.
  ctx.on(MESSAGE_TYPES.GET_EXTENSION_STATUS, async (request): Promise<MessageResponse<{ active: boolean }>> => {
    const parsed = EmptyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid GET_EXTENSION_STATUS payload: ${parsed.error.message}` };
    }
    return { success: true, data: { active: ctx.extensionActive } };
  });

  // TOGGLE_EXTENSION: toggle, persist, and start/stop the interceptor.
  ctx.on(MESSAGE_TYPES.TOGGLE_EXTENSION, async (request): Promise<MessageResponse<{ active: boolean }>> => {
    const parsed = EmptyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TOGGLE_EXTENSION payload: ${parsed.error.message}` };
    }
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
