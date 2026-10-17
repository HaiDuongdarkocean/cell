import type { PronunciationSettings } from '@/entities/settings/types';
import type { SrsAudioAsset } from '@/entities/srs/types';
import {
  getCachedAudioAsset,
  storeAudioAsset,
  fetchAndCacheWordAudio,
  fetchAndCacheSentenceAudio,
} from './audioAssetCache';
import { resolveOrStore } from './quotaManager';
import { createBlobUrl, revokeBlobUrl } from '@/shared/lib/blobUrl';

/** Create a blob URL for an audio asset. Caller must revoke when done. */
export function createAudioBlobUrl(asset: SrsAudioAsset): string {
  return createBlobUrl(asset.bytes, asset.mimeType);
}

/** Revoke a blob URL returned by `createAudioBlobUrl`. */
export function revokeAudioBlobUrl(url: string): void {
  revokeBlobUrl(url);
}

/** Resolve or reuse cached word audio for a note field. */
export async function resolveWordAudio(
  noteId: string,
  fieldId: string,
  term: string,
  langCode: string,
  settings: PronunciationSettings,
): Promise<SrsAudioAsset | undefined> {
  return resolveOrStore(
    () => getCachedAudioAsset(noteId, fieldId),
    () => fetchAndCacheWordAudio(noteId, fieldId, term, langCode, settings),
  );
}

/** Resolve or reuse cached sentence audio for a note field. */
export async function resolveSentenceAudio(
  noteId: string,
  fieldId: string,
  text: string,
  langCode: string,
): Promise<SrsAudioAsset | undefined> {
  return resolveOrStore(
    () => getCachedAudioAsset(noteId, fieldId),
    () => fetchAndCacheSentenceAudio(noteId, fieldId, text, langCode),
  );
}

/**
 * Store externally-provided audio bytes for a note field.
 * Use when the caller already has the audio (e.g. user upload / Card Creator).
 */
export async function cacheAudioBytes(
  noteId: string,
  fieldId: string,
  bytes: ArrayBuffer,
  mimeType: string,
  source: SrsAudioAsset['source'],
  index = 0,
): Promise<SrsAudioAsset> {
  return storeAudioAsset(noteId, fieldId, bytes, mimeType, source, index);
}
