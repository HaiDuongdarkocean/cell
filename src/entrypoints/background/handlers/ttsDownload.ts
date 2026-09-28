/**
 * TTS voice pack download handler — TTS_DOWNLOAD_VOICE.
 *
 * The download itself runs in the offscreen document (OPFS + fetch). The
 * JobRegistry owns the job: progress arrives via TTS_DOWNLOAD_PROGRESS from
 * the offscreen runner, and the completion effect (settings.tts
 * downloadedLanguages/localTtsLanguage) is applied here — never by the
 * mortal Settings panel that started the download.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { TtsDownloadProgressPayloadSchema, TtsDownloadVoicePayloadSchema } from '@/entities/message/dictionarySchemas';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { JobDuplicateError } from '@/features/jobs/logic/jobRegistry';
import { getJobRegistry } from './jobs';
import { isVoicePackDownloaded } from '@/features/tts/services/ttsDownloadManager';
import {
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_TTS_SETTINGS,
} from '@/shared/config/config';

async function applyVoiceDownloadEffect(ctx: BackgroundContext, language: string): Promise<void> {
  const settings = await ctx.loadSettings();
  const popup = settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS;
  const tts = popup.tts ?? DEFAULT_TTS_SETTINGS;
  await ctx.saveSettings({
    ...settings,
    dictionaryPopup: {
      ...popup,
      tts: {
        ...tts,
        downloadedLanguages: Array.from(new Set([...tts.downloadedLanguages, language])),
        localTtsLanguage: language,
      },
    },
  });
}

export function registerTtsDownloadHandlers(ctx: BackgroundContext): void {
  const registry = getJobRegistry();

  registry.registerExecutor('voice-download', {
    start: async (job) => {
      const language = job.params.language as string;
      const response = await ctx.offscreenManager.sendToOffscreen<MessageResponse<boolean>>({
        type: MESSAGE_TYPES.TTS_DOWNLOAD_VOICE,
        payload: { language, jobId: job.id },
      });
      if (!response?.success) {
        throw new Error(response?.error ?? 'Voice pack download failed');
      }
      try {
        await applyVoiceDownloadEffect(ctx, language);
        registry.markDone(job.id, { language });
      } catch (err) {
        registry.markFailed(job.id, err instanceof Error ? err.message : String(err), true);
      }
    },
    reconcile: async (job) => {
      const language = job.params.language as string;
      const installed = await isVoicePackDownloaded();
      if (!installed) return 'interrupted';
      await applyVoiceDownloadEffect(ctx, language);
      return 'done';
    },
  });

  ctx.on(MESSAGE_TYPES.TTS_DOWNLOAD_VOICE, async (request): Promise<MessageResponse<{ jobId: string }>> => {
    const parsed = TtsDownloadVoicePayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TTS_DOWNLOAD_VOICE payload: ${parsed.error.message}` } as MessageResponse<{ jobId: string }>;
    }
    const { language } = parsed.data;
    try {
      const existing = registry.findActive('voice-download', { language });
      if (existing) return { success: true, data: { jobId: existing.id } };

      const job = registry.register({
        id: `tts-${language}-${Date.now().toString(36)}`,
        kind: 'voice-download',
        label: language,
        status: 'queued',
        params: { language },
        retryable: true,
      });
      registry.startIfSlotFree(job);
      return { success: true, data: { jobId: job.id } };
    } catch (err) {
      if (err instanceof JobDuplicateError) {
        const existing = registry.findActive('voice-download', { language });
        if (existing) return { success: true, data: { jobId: existing.id } };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `TTS voice download failed: ${msg}` } as MessageResponse<{ jobId: string }>;
    }
  });

  // Progress fan-out from offscreen → registry job.
  ctx.on(MESSAGE_TYPES.TTS_DOWNLOAD_PROGRESS, async (request): Promise<MessageResponse<null>> => {
    const parsed = TtsDownloadProgressPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TTS_DOWNLOAD_PROGRESS payload: ${parsed.error.message}` };
    }
    const { language, loaded, total, jobId } = parsed.data;
    const job = jobId !== undefined
      ? registry.get(jobId)
      : registry.findActive('voice-download', { language });
    if (job && job.status === 'running') {
      registry.setProgress(job.id, { done: loaded, total, unit: 'bytes' });
    }
    return { success: true, data: null };
  });
}
