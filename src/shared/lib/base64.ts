const nativeFromBase64 = (
  Uint8Array as unknown as { fromBase64?: (data: string) => Uint8Array }
).fromBase64;

const nativeToBase64 = (
  Uint8Array.prototype as unknown as { toBase64?: (this: Uint8Array) => string }
).toBase64;

export function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  if (nativeFromBase64 !== undefined) {
    return nativeFromBase64(base64).buffer as ArrayBuffer;
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function encodeBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (nativeToBase64 !== undefined) {
    return nativeToBase64.call(bytes);
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL');
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (meta.includes(';base64')) {
    return decodeBase64ToArrayBuffer(body);
  }
  return new TextEncoder().encode(decodeURIComponent(body)).buffer;
}

export function bytesToDataUrl(bytes: ArrayBuffer | Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${encodeBase64(bytes)}`;
}
