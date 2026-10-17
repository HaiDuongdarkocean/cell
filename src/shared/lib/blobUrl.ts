import { encodeBase64 } from '@/shared/lib/base64';

export function createBlobUrl(bytes: ArrayBuffer | Uint8Array, mimeType: string): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const part = bytes instanceof Uint8Array ? new Uint8Array(bytes) : bytes;
    return URL.createObjectURL(new Blob([part], { type: mimeType }));
  }
  return `data:${mimeType};base64,${encodeBase64(bytes)}`;
}

export function revokeBlobUrl(url: string): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  try {
    URL.revokeObjectURL(url);
  } catch {
  }
}
