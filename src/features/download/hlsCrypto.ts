import type { HlsEncryption } from '@/entities/media';
import { buildFetchHeaders } from './segmentFetch';

export type Aes128KeyCache = Map<string, CryptoKey>;

/**
 * Parse an IV hex string (e.g. "0x1234567890ABCDEF...") into a 16-byte Uint8Array.
 * The "0x" prefix is stripped if present. The hex string must be exactly 32 chars
 * (16 bytes) after stripping the prefix.
 */
export function parseIvFromHex(ivHex: string): Uint8Array {
  const hex = ivHex.startsWith('0x') || ivHex.startsWith('0X')
    ? ivHex.slice(2)
    : ivHex;
  if (hex.length !== 32) {
    throw new Error(
      `AES-128 IV must be 16 bytes (32 hex chars), got ${hex.length} chars`,
    );
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derive a 16-byte IV from a segment sequence number per RFC 8216 §4.3.2.4.
 * The sequence number is placed in the rightmost (least significant) bytes
 * of a 16-byte big-endian integer, with all preceding bytes set to zero.
 */
export function deriveIvFromSequence(sequence: number): Uint8Array {
  const bytes = new Uint8Array(16);
  // Write sequence as big-endian in the last 8 bytes (safe for sequences < 2^53)
  const view = new DataView(bytes.buffer);
  view.setUint32(12, Math.floor(sequence / 0x100000000));
  view.setUint32(8, sequence >>> 0);
  return bytes;
}

/**
 * Fetch an AES-128 decryption key from the URI specified in `#EXT-X-KEY`.
 * The key is a 16-byte raw ArrayBuffer. Uses the same headers as the
 * playlist fetch (Referer/Origin) to pass hotlink protection on key CDNs.
 *
 * Results are cached per `cacheKey` (typically the keyUri) in the injected
 * `keyCache` to avoid re-fetching the same key for every segment.
 */
export async function fetchAes128Key(
  keyCache: Aes128KeyCache,
  keyUri: string,
  tabUrl?: string,
  cacheKey?: string,
  signal?: AbortSignal,
): Promise<CryptoKey> {
  const ck = cacheKey ?? keyUri;
  const cached = keyCache.get(ck);
  if (cached) return cached;

  const response = await fetch(keyUri, {
    credentials: 'same-origin',
    headers: buildFetchHeaders(tabUrl),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch AES-128 key: ${response.status}`);
  }
  const keyBuffer = await response.arrayBuffer();
  if (keyBuffer.byteLength !== 16) {
    throw new Error(
      `AES-128 key must be 16 bytes, got ${keyBuffer.byteLength}`,
    );
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );
  keyCache.set(ck, cryptoKey);
  return cryptoKey;
}

/**
 * Decrypt an AES-128-CBC encrypted segment blob.
 *
 * IV handling:
 * - If `encryption.iv` is present, parse it as a hex string → 16-byte Uint8Array.
 * - If absent, derive from segment sequence number (16-byte big-endian per RFC 8216 §4.3.2.4).
 *
 * @returns Decrypted Blob (video/mp2t)
 */
export async function decryptSegment(
  encryptedBlob: Blob,
  key: CryptoKey,
  encryption: HlsEncryption,
  sequence?: number,
): Promise<Blob> {
  const encryptedData = new Uint8Array(await encryptedBlob.arrayBuffer());

  let iv: Uint8Array;
  if (encryption.iv) {
    iv = parseIvFromHex(encryption.iv);
  } else {
    iv = deriveIvFromSequence(sequence ?? 0);
  }

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: iv as BufferSource },
    key,
    encryptedData,
  );

  return new Blob([decryptedBuffer], { type: 'video/mp2t' });
}
