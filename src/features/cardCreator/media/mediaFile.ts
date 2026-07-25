/**
 * MediaFile — shared type for extracted media (screenshot, audio) + helpers.
 *
 * A MediaFile is the in-memory representation of a file destined for Anki's
 * collection.media via `storeMediaFile`. It carries the raw bytes (ArrayBuffer)
 * + filename + mime type, plus helpers to convert to base64 (for the
 * AnkiConnect `data` field) and to build the Anki field reference string
 * (`<img src="...">` for images, `[sound:...]` for audio).
 */

/** Kind of media — determines the Anki field reference format. */
export type MediaKind = 'image' | 'audio';

/** In-memory media file ready for upload to AnkiConnect. */
export interface MediaFile {
  readonly kind: MediaKind;
  /** Filename (without path). Will be stored in Anki's collection.media. */
  readonly filename: string;
  /** MIME type, e.g. 'image/png', 'audio/webm'. */
  readonly mimeType: string;
  /** Raw file bytes. */
  readonly data: ArrayBuffer;
}

/** Convert ArrayBuffer to base64 string (no data: prefix). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks — avoid call stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
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
  return `cell-${prefix}-${ts}-${rand}.${ext}`;
}

/** MIME type → file extension lookup for common media types. */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
};

/** Fetch a URL and convert it to a MediaFile.
 *  Used by the popup dictionary bridge to turn selected audio/image URLs
 *  (Forvo, Google Images) into MediaFile entries for the Card Creator draft.
 *  Throws on fetch failure or non-ok response — caller handles (skip item).
 *  ponytail: best-effort — caller wraps in try/catch and skips on failure. */
export async function fetchUrlAsMediaFile(
  url: string,
  kind: MediaKind,
  fetchFn: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<MediaFile> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Media fetch failed: ${response.status} ${url}`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || (kind === 'image' ? 'image/png' : 'audio/mpeg');
  const ext = MIME_TO_EXT[mimeType] ?? (kind === 'image' ? 'png' : 'mp3');
  const data = await blob.arrayBuffer();
  const prefix = kind === 'image' ? 'img' : 'audio';
  return {
    kind,
    filename: generateMediaFilename(prefix, ext),
    mimeType,
    data,
  };
}

/** Parse a data: URL (base64) into an ArrayBuffer without using fetch()
 *  (avoids CSP issues with data: URLs on strict pages). */
function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Fetch a media URL via the background SW (bypasses page CSP).
 *  Returns a MediaFile on success, throws on failure. */
async function fetchMediaViaBackground(url: string, kind: MediaKind): Promise<MediaFile> {
  const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
  const { MESSAGE_TYPES } = await import('@/shared/config/messages');
  const res = await sendMessage<{ success: boolean; data?: { url: string }; error?: string }>({
    type: MESSAGE_TYPES.FETCH_MEDIA_URL,
    payload: { tabId: 0, url, kind },
  });
  if (!res?.success || !res.data?.url) {
    throw new Error(res?.error ?? `Background fetch failed for ${url}`);
  }
  const dataUrl = res.data.url;
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
  const ext = MIME_TO_EXT[mimeType] ?? (kind === 'image' ? 'png' : 'mp3');
  const prefix = kind === 'image' ? 'img' : 'audio';
  return {
    kind,
    filename: generateMediaFilename(prefix, ext),
    mimeType,
    data: dataUrlToArrayBuffer(dataUrl),
  };
}

/** Fetch a media URL as a MediaFile. Tries content-script fetch first (fast,
 *  works for same-origin + permissive CSP), falls back to background fetch
 *  (bypasses strict CSP via FETCH_MEDIA_URL message). */
export async function fetchMediaFile(url: string, kind: MediaKind): Promise<MediaFile> {
  try {
    return await fetchUrlAsMediaFile(url, kind);
  } catch {
    return fetchMediaViaBackground(url, kind);
  }
}
