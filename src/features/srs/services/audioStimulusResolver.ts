import type { PronunciationSettings } from '@/entities/settings/types';
import type { SrsAudioAsset } from '@/entities/srs/types';
import {
  getCachedAudioAsset,
  storeAudioAsset,
  fetchAndCacheWordAudio,
  fetchAndCacheSentenceAudio,
} from './audioAssetCache';

/** Create a blob URL for an audio asset. Caller must revoke when done. */
export function createAudioBlobUrl(asset: SrsAudioAsset): string {
  const blob = new Blob([asset.bytes], { type: asset.mimeType });
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return `data:${asset.mimeType};base64,${btoa(String.fromCharCode(...new Uint8Array(asset.bytes)))}`;
}

/** Revoke a blob URL returned by `createAudioBlobUrl`. */
export function revokeAudioBlobUrl(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

/** Resolve or reuse cached word audio for a note field. */
export async function resolveWordAudio(
  noteId: string,
  fieldId: string,
  term: string,
  langCode: string,
  settings: PronunciationSettings,
): Promise<SrsAudioAsset | undefined> {
  const cached = await getCachedAudioAsset(noteId, fieldId);
  if (cached) return cached;
  return fetchAndCacheWordAudio(noteId, fieldId, term, langCode, settings);
}

/** Resolve or reuse cached sentence audio for a note field. */
export async function resolveSentenceAudio(
  noteId: string,
  fieldId: string,
  text: string,
  langCode: string,
): Promise<SrsAudioAsset | undefined> {
  const cached = await getCachedAudioAsset(noteId, fieldId);
  if (cached) return cached;
  return fetchAndCacheSentenceAudio(noteId, fieldId, text, langCode);
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
): Promise<SrsAudioAsset> {
  return storeAudioAsset(noteId, fieldId, bytes, mimeType, source);
}
