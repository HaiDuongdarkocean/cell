/**
 * MediaFile — shared type for extracted media (screenshot, audio) + helpers.
 *
 * A MediaFile is the in-memory representation of a file destined for Anki's
 * collection.media via `storeMediaFile`. It carries the raw bytes (ArrayBuffer)
 * + filename + mime type, plus helpers to convert to base64 (for the
 * AnkiConnect `data` field) and to build the Anki field reference string
 * (`<img src="...">` for images, `[sound:...]` for audio).
 */

import type { MediaFile, MediaKind } from '@/entities/media';
import type { AudioItem, ImageItem } from '@/entities/dictionary';
import { dataUrlToArrayBuffer, encodeBase64 } from '@/shared/lib/base64';
import { mimeToExt } from '@/shared/lib/mime';

export type { MediaFile, MediaKind };

/** Convert ArrayBuffer to base64 string (no data: prefix). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return encodeBase64(buffer);
}

/** Build the Anki field reference for a media file.
 *  - image → `<img src="filename">`
 *  - audio → `[sound:filename]` */
export function buildAnkiFieldRef(file: Pick<MediaFile, 'kind' | 'filename'>): string {
  if (file.kind === 'image') {
    return `<img src="${file.filename}">`;
  }
  return `[sound:${file.filename}]`;
}

/** Join multiple media field refs into a single field value.
 *  - images → joined with `<br>`
 *  - audio → joined with space */
export function joinAnkiFieldRefs(files: readonly MediaFile[]): string {
  if (files.length === 0) return '';
  const refs = files.map((f) => buildAnkiFieldRef(f));
  if (files[0].kind === 'image') {
    return refs.join('<br>');
  }
  return refs.join(' ');
}

/** Generate a filename with timestamp + uuid suffix to avoid collisions. */
export function generateMediaFilename(prefix: string, ext: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `Tihoka-${prefix}-${ts}-${rand}.${ext}`;
}

/** Per-file fetch timeout — a dead URL must not stall the caller forever
 *  (generate-all disables its button until every fetch settles). */
const FETCH_TIMEOUT_MS = 15_000;

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Media fetch timed out after ${FETCH_TIMEOUT_MS}ms`)),
      FETCH_TIMEOUT_MS,
    );
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** Fetch a URL and convert it to a MediaFile.
 *  Used by the popup dictionary bridge to turn selected audio/image URLs
 *  (Forvo, Google Images) into MediaFile entries for the Card Creator draft.
 *  Throws on fetch failure or non-ok response — caller handles (skip item).
 *  ponytail: best-effort — caller wraps in try/catch and skips on failure. */
/** Parse a data: or blob: URL into a MediaFile without a network round-trip.
 *  Blob URLs cannot be fetched cross-context; this returns null so the caller
 *  can fall back to the source bytes if available. */
function mediaFromDataOrBlobUrl(url: string, kind: MediaKind): MediaFile | null {
  if (url.startsWith('data:')) {
    const mimeType = url.slice(5, url.indexOf(';'));
    const ext = mimeToExt(mimeType) ?? (kind === 'image' ? 'png' : 'mp3');
    const prefix = kind === 'image' ? 'img' : 'audio';
    return {
      kind,
      filename: generateMediaFilename(prefix, ext),
      mimeType,
      data: dataUrlToArrayBuffer(url),
      sourceUrl: url,
    };
  }
  return null;
}

export async function fetchUrlAsMediaFile(
  url: string,
  kind: MediaKind,
  fetchFn: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<MediaFile> {
  const dataFile = mediaFromDataOrBlobUrl(url, kind);
  if (dataFile) return dataFile;

  const response = await fetchFn(url, { signal: timeoutSignal() });
  if (!response.ok) {
    throw new Error(`Media fetch failed: ${response.status} ${url}`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || (kind === 'image' ? 'image/png' : 'audio/mpeg');
  const ext = mimeToExt(mimeType) ?? (kind === 'image' ? 'png' : 'mp3');
  const data = await blob.arrayBuffer();
  const prefix = kind === 'image' ? 'img' : 'audio';
  return {
    kind,
    filename: generateMediaFilename(prefix, ext),
    mimeType,
    data,
    sourceUrl: url,
  };
}

/** Fetch a media URL via the background SW (bypasses page CSP).
 *  Returns a MediaFile on success, throws on failure. */
async function fetchMediaViaBackground(url: string, kind: MediaKind): Promise<MediaFile> {
  const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
  const { MESSAGE_TYPES } = await import('@/shared/config/messages');
  const res = await withTimeout(
    sendMessage<{ success: boolean; data?: { url: string }; error?: string }>({
      type: MESSAGE_TYPES.FETCH_MEDIA_URL,
      payload: { tabId: 0, url, kind },
    }),
  );
  if (!res?.success || !res.data?.url) {
    throw new Error(res?.error ?? `Background fetch failed for ${url}`);
  }
  const dataUrl = res.data.url;
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
  const ext = mimeToExt(mimeType) ?? (kind === 'image' ? 'png' : 'mp3');
  const prefix = kind === 'image' ? 'img' : 'audio';
  return {
    kind,
    filename: generateMediaFilename(prefix, ext),
    mimeType,
    data: dataUrlToArrayBuffer(dataUrl),
    sourceUrl: url,
  };
}

/** Fetch a media URL as a MediaFile. Tries content-script fetch first (fast,
 *  works for same-origin + permissive CSP), falls back to background fetch
 *  (bypasses strict CSP via FETCH_MEDIA_URL message).
 *  data: URLs are parsed locally, avoiding CSP/fetch issues. */
export async function fetchMediaFile(url: string, kind: MediaKind): Promise<MediaFile> {
  const dataFile = mediaFromDataOrBlobUrl(url, kind);
  if (dataFile) return dataFile;

  try {
    return await fetchUrlAsMediaFile(url, kind);
  } catch {
    return fetchMediaViaBackground(url, kind);
  }
}

/** Build a MediaFile from an AudioItem, using audioBytes or url. */
export async function mediaFromAudioItem(item: AudioItem): Promise<MediaFile | null> {
  if (item.audioBytes?.length) {
    const ext = 'wav';
    const sourceUrl = `audio-bytes://${item.id}`;
    const data = new ArrayBuffer(item.audioBytes.length);
    new Uint8Array(data).set(item.audioBytes);
    return {
      kind: 'audio',
      filename: generateMediaFilename('audio', ext),
      mimeType: 'audio/wav',
      data,
      sourceUrl,
    };
  }
  if (!item.url) return null;
  const dataFile = mediaFromDataOrBlobUrl(item.url, 'audio');
  if (dataFile) return dataFile;
  return fetchMediaFile(item.url, 'audio').catch(() => null);
}

/** Build a MediaFile from an ImageItem, using its src URL. */
export async function mediaFromImageItem(item: ImageItem): Promise<MediaFile | null> {
  if (!item.src) return null;
  const dataFile = mediaFromDataOrBlobUrl(item.src, 'image');
  if (dataFile) return dataFile;
  return fetchMediaFile(item.src, 'image').catch(() => null);
}
