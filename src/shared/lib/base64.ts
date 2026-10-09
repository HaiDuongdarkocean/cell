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

type WithNativeBase64 = {
  fromBase64?: (base64: string) => Uint8Array;
};
type BytesWithToBase64 = Uint8Array & { toBase64?: () => string };

/** Decode base64 to bytes — native `Uint8Array.fromBase64` (ES2025, Chrome
 *  133+) when present, else the atob fallback. Per-chunk decode keeps peak
 *  memory bounded for large import payloads. */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const native = (Uint8Array as unknown as WithNativeBase64).fromBase64;
  if (native) return native.call(Uint8Array, base64);
  return new Uint8Array(decodeBase64ToArrayBuffer(base64));
}

/** Encode an ArrayBuffer or Uint8Array to a base64 string. Inverse of `decodeBase64ToArrayBuffer`.
 *  Chunks to avoid `String.fromCharCode(...spread)` stack overflow on large buffers. */
export function encodeBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const toBase64 = (bytes as BytesWithToBase64).toBase64;
  if (toBase64) return toBase64.call(bytes);
  let binary = '';
  const chunkSize = 0x8000; // 32KB — safe for V8 spread arg limit
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
