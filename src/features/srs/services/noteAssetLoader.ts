import type { SrsAudioAsset, SrsFieldValue, SrsImageAsset, SrsNote } from '@/entities/srs/types';
import { audioAssetId, imageAssetId, isDataUrl } from '@/features/srs/lib/helpers';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { cacheAudioBytes } from './audioStimulusResolver';
import { cacheImageBytes, resolveImageDataUrl } from './imageStimulusResolver';
import { fetchMediaAsArrayBuffer } from './fetchMedia';

function mimeFromDataUrl(url: string, fallback: string): string {
  if (!url.startsWith('data:')) return fallback;
  const meta = url.slice(5, url.indexOf(';') === -1 ? url.indexOf(',') : url.indexOf(';'));
  return meta || fallback;
}

/**
 * Fetch and cache audio/image field values for a note.
 *
 * Text/list/translation/context fields are skipped. Audio and image fields are
 * downloaded (or decoded from data URLs) and stored in the SRS asset cache so
 * review sessions can render them offline as blob URLs.
 */
export async function cacheNoteFields(note: SrsNote): Promise<void> {
  await Promise.all(
    Object.entries(note.fields).map(async ([fieldId, value]) => {
      try {
        await cacheNoteFieldValue(note.id, fieldId, value);
      } catch {
        // Failed to fetch a media asset; leave the original value and let the
        // review surface fall back to the next available template.
      }
    }),
  );
}

async function cacheNoteFieldValue(
  noteId: string,
  fieldId: string,
  value: SrsFieldValue,
): Promise<SrsAudioAsset | SrsImageAsset | undefined> {
  if (value.kind === 'audio') {
    const cached = await loadCachedAudio(noteId, fieldId);
    if (cached) return cached;
    const bytes = await fetchMediaAsArrayBuffer(value.value);
    const mime = mimeFromDataUrl(value.value, 'audio/mpeg');
    return cacheAudioBytes(noteId, fieldId, bytes, mime, value.source);
  }

  if (value.kind === 'image') {
    const cached = await loadCachedImage(noteId, fieldId);
    if (cached) return cached;
    if (isDataUrl(value.value)) {
      return resolveImageDataUrl(noteId, fieldId, value.value);
    }
    const bytes = await fetchMediaAsArrayBuffer(value.value);
    const mime = mimeFromDataUrl(value.value, 'image/png');
    return cacheImageBytes(noteId, fieldId, bytes, mime);
  }

  return undefined;
}

async function loadCachedAudio(noteId: string, fieldId: string): Promise<SrsAudioAsset | undefined> {
  const assets = await getAudioAssetsByNote(noteId);
  return assets.find((a) => a.fieldId === fieldId);
}

async function loadCachedImage(noteId: string, fieldId: string): Promise<SrsImageAsset | undefined> {
  const assets = await getImageAssetsByNote(noteId);
  return assets.find((a) => a.fieldId === fieldId);
}

/**
 * Load all audio/image assets for a note from IndexedDB into the provided in-memory maps.
 *
 * These maps are used by `resolveReviewSurface` to build blob URLs for cached media
 * without making network calls during a study session.
 */
export async function loadNoteAssets(
  note: SrsNote,
  audioMap: Map<string, SrsAudioAsset>,
  imageMap: Map<string, SrsImageAsset>,
): Promise<void> {
  const [audioAssets, imageAssets] = await Promise.all([
    getAudioAssetsByNote(note.id),
    getImageAssetsByNote(note.id),
  ]);

  for (const asset of audioAssets) {
    audioMap.set(audioAssetId(note.id, asset.fieldId, asset.source), asset);
  }

  for (const asset of imageAssets) {
    imageMap.set(imageAssetId(note.id, asset.fieldId), asset);
  }
}
