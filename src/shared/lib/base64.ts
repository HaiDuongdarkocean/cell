/**
 * Base64 ↔ ArrayBuffer helpers — binary-safe transport across message ports.
 *
 * Used by offscreen fetch (background ↔ offscreen document) where structured
 * clone can carry ArrayBuffer but the existing FetchResponsePayload contract
 * uses string. Base64 bridges that without changing the message shape.
 */

/** Decode a base64 string to a fresh ArrayBuffer. Inverse of `encodeBase64`. */
export function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Encode an ArrayBuffer to a base64 string. Inverse of `decodeBase64ToArrayBuffer`.
 *  Chunks to avoid `String.fromCharCode(...spread)` stack overflow on large buffers. */
export function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB — safe for V8 spread arg limit
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
