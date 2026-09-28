/**
 * Local audio handler — FETCH_LOCAL_AUDIO.
 *
 * Reads the user's configured local Forvo package, queries the `.dsl` index,
 * and resolves audio entries from the zip archive. Returns `AudioItem[]` with
 * raw `audioBytes` (Uint8Array). The content script creates and revokes blob
 * URLs so object lifetimes stay in the same context as the audio element.
 */

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  FetchLocalAudioPayloadSchema,
  FetchLocalAudioResponseSchema,
  LocalAudioBuildIndexPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import type {
  FetchLocalAudioResponse,
  LocalAudioBuildIndexResponse,
  LocalAudioStateResponse,
} from '@/entities/dictionary';
import type { LocalFileAudioSettings } from '@/entities/settings';
import { LingvoDslAudioProvider } from '@/features/pronunciation/services/lingvoDslAudioProvider';
import { parseLingvoDsl } from '@/features/pronunciation/services/lingvoDslParser';
import {
  countLingvoDslIndex,
  saveLingvoDslIndex,
} from '@/features/pronunciation/repositories/lingvoDslIndexRepository';
import { getFileHandle } from '@/shared/lib/storage/localFileHandleStorage';
import { getJobRegistry, whenJobsReady } from './jobs';
import { DEFAULT_PRONUNCIATION_SETTINGS } from '@/shared/config/config';

let cachedProvider: { key: string; provider: LingvoDslAudioProvider } | null = null;

function providerFor(localFile: LocalFileAudioSettings): LingvoDslAudioProvider {
  const key = JSON.stringify(localFile);
  if (cachedProvider?.key !== key) {
    cachedProvider = { key, provider: new LingvoDslAudioProvider(localFile) };
  }
  return cachedProvider.provider;
}

export function registerLocalAudioHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.FETCH_LOCAL_AUDIO, async (request): Promise<MessageResponse<FetchLocalAudioResponse>> => {
    const parsed = FetchLocalAudioPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid FETCH_LOCAL_AUDIO payload: ${parsed.error.message}`,
      };
    }

    const { term, langCode } = parsed.data;

    try {
      const settings = await ctx.loadSettings();
      const localFile = settings.pronunciation?.localFile;
      if (!localFile) {
        return { success: true, data: { items: [] } };
      }

      const items = await providerFor(localFile).resolve(term, langCode);
      const data = { items };
      FetchLocalAudioResponseSchema.parse(data);
      return { success: true, data };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: t('audio.error.localFetch', [msg]) };
    }
  });

  ctx.on(MESSAGE_TYPES.LOCAL_AUDIO_STATE, async (): Promise<MessageResponse<LocalAudioStateResponse>> => {
    try {
      const settings = await ctx.loadSettings();
      const localFile = settings.pronunciation?.localFile;
      const handleId = localFile?.packageType === 'split'
        ? localFile.splitArchiveDirectoryHandleId
        : localFile?.audioArchiveHandleId;
      if (!handleId) {
        return { success: true, data: { configured: false, permission: 'none' } };
      }
      const handle = await getFileHandle(handleId);
      if (!handle) {
        return { success: true, data: { configured: true, permission: 'none' } };
      }
      const permission = await handle.queryPermission({ mode: 'read' });
      return { success: true, data: { configured: true, permission } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: t('audio.error.localState', [msg]) };
    }
  });

  const registry = getJobRegistry();

  async function buildDslIndex(dslFileHandleId: string): Promise<number> {
    const handle = await getFileHandle(dslFileHandleId);
    if (!handle || handle.kind !== 'file') {
      throw new Error(t('audio.error.handleMissing'));
    }
    const permission = await handle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      throw new Error(t('audio.error.filePermission'));
    }
    const file = await (handle as FileSystemFileHandle).getFile();
    const text = await file.text();
    const entries = parseLingvoDsl(text, dslFileHandleId);
    await saveLingvoDslIndex(dslFileHandleId, entries);
    return entries.length;
  }

  async function applyIndexEffect(dslFileHandleId: string): Promise<void> {
    const settings = await ctx.loadSettings();
    const pronunciation = settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS;
    if (pronunciation.localFile.dslFileHandleId !== dslFileHandleId) return;
    await ctx.saveSettings({
      ...settings,
      pronunciation: {
        ...pronunciation,
        localFile: { ...pronunciation.localFile, lastIndexedAt: Date.now() },
      },
    });
  }

  registry.registerExecutor('local-audio-index', {
    start: async (job) => {
      const dslFileHandleId = job.params.dslFileHandleId as string;
      const count = await buildDslIndex(dslFileHandleId);
      try {
        await applyIndexEffect(dslFileHandleId);
        registry.markDone(job.id, { count });
      } catch (err) {
        registry.markFailed(job.id, err instanceof Error ? err.message : String(err), true);
      }
    },
    reconcile: async (job) => {
      const dslFileHandleId = job.params.dslFileHandleId as string;
      const count = await countLingvoDslIndex(dslFileHandleId);
      if (count === 0) return 'interrupted';
      await applyIndexEffect(dslFileHandleId);
      return 'done';
    },
  });

  ctx.on(MESSAGE_TYPES.LOCAL_AUDIO_BUILD_INDEX, async (request): Promise<MessageResponse<LocalAudioBuildIndexResponse>> => {
    await whenJobsReady();
    const parsed = LocalAudioBuildIndexPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid LOCAL_AUDIO_BUILD_INDEX payload: ${parsed.error.message}`,
      };
    }
    try {
      const { dslFileHandleId } = parsed.data;
      const existing = registry.findActive('local-audio-index', { dslFileHandleId });
      if (existing) return { success: true, data: { jobId: existing.id } };

      const job = registry.register({
        id: `dsl-${dslFileHandleId}-${Date.now().toString(36)}`,
        kind: 'local-audio-index',
        label: dslFileHandleId,
        status: 'queued',
        params: { dslFileHandleId },
        retryable: true,
      });
      registry.startIfSlotFree(job);
      return { success: true, data: { jobId: job.id } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: t('audio.error.localIndex', [msg]) };
    }
  });

  ctx.on(MESSAGE_TYPES.LOCAL_AUDIO_OPEN_RECONNECT, async (): Promise<MessageResponse<{ tabId: number }>> => {
    const tab = await chrome.tabs.create({
      url: chrome.runtime.getURL('src/entrypoints/popup/index.html'),
    });
    if (tab.id === undefined) {
      return { success: false, error: 'Failed to create tab' };
    }
    return { success: true, data: { tabId: tab.id } };
  });
}
