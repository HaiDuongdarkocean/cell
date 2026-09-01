import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message/types';

interface FetchMediaUrlResponse {
  readonly url: string;
}

/**
 * Fetch a media URL as an ArrayBuffer.
 * For http(s) URLs, prefers `fetch` and falls back to the extension's
 * `FETCH_MEDIA_URL` message (used by content scripts limited by CSP).
 * For `data:` URLs, decodes the base64 payload directly.
 */
export async function fetchMediaAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    return dataUrlToArrayBuffer(url);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  } catch {
    const res = await sendMessage<MessageResponse<FetchMediaUrlResponse>>({
      type: MESSAGE_TYPES.FETCH_MEDIA_URL,
      payload: { tabId: 0, url, kind: 'audio' },
    });
    if (!res?.success || !res.data?.url) throw new Error(`Could not fetch media: ${url}`);
    return dataUrlToArrayBuffer(res.data.url);
  }
}

/** Decode a data URL into an ArrayBuffer. */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL');

  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const isBase64 = meta.includes(';base64');

  if (isBase64) {
    const binary = atob(body);
    const len = binary.length;
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buf[i] = binary.charCodeAt(i);
    }
    return buf.buffer;
  }

  const decoded = decodeURIComponent(body);
  const encoder = new TextEncoder();
  return encoder.encode(decoded).buffer;
}
