/**
 * Local audio handler — FETCH_LOCAL_AUDIO.
 *
 * Reads the user's configured local Forvo package, queries the `.dsl` index,
 * and resolves audio entries from the zip archive. Returns `AudioItem[]` with
 * raw `audioBytes` (Uint8Array). The content script creates and revokes blob
 * URLs so object lifetimes stay in the same context as the audio element.
 */

import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { FetchLocalAudioPayloadSchema, FetchLocalAudioResponseSchema } from '@/entities/message/dictionarySchemas';
import type { FetchLocalAudioResponse, LocalAudioStateResponse } from '@/entities/dictionary';
import type { LocalFileAudioSettings } from '@/entities/settings';
import { LingvoDslAudioProvider } from '@/features/pronunciation/services/lingvoDslAudioProvider';
import { getFileHandle } from '@/shared/lib/storage/localFileHandleStorage';

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
      return { success: false, error: `Local audio fetch failed: ${msg}` };
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
      return { success: false, error: `Local audio state failed: ${msg}` };
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
