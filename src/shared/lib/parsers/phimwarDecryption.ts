import { decodeBase64ToArrayBuffer } from '@/shared/lib/base64';

const PHIMWAR_SUBTITLE_PATH_PATTERN = /^\/api\/subtitle\/[^/]+\/[^/]+$/i;

/**
 * Check whether a URL is a PhimWar encrypted subtitle file.
 *
 * Parses the URL so query strings and hashes do not accidentally match.
 */
export function isPhimwarSubtitleUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.search || u.hash) return false;
    if (!u.hostname.endsWith('phimwar.com')) return false;
    return PHIMWAR_SUBTITLE_PATH_PATTERN.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Extract the filename (e.g. `v07.srt`) from a PhimWar subtitle URL.
 */
export function getPhimwarFileName(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.split('/').pop();
    return fileName ?? null;
  } catch {
    return null;
  }
}

/**
 * Shift Latin letters by +19 (mod 26). Matches the player's `nn` function.
 */
function shiftFilename(fileName: string): string {
  return fileName.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode((c.charCodeAt(0) - base + 19) % 26 + base);
  });
}

/**
 * Derive the AES-GCM key from a PhimWar subtitle filename.
 *
 * Key material = SHA-256(`/watch/` + caesarShift(fileName, +19))
 */
export async function derivePhimwarKey(fileName: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(`/watch/${shiftFilename(fileName)}`);
  const hash = await crypto.subtle.digest('SHA-256', keyMaterial);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
}

/**
 * Decrypt a PhimWar subtitle payload.
 *
 * The body returned by `.../api/subtitle/<id>/<fileName>` is a base64 string.
 * After decoding, the first 12 bytes are the AES-GCM IV and the rest is the
 * ciphertext + authentication tag.
 */
export async function decryptPhimwarSrt(
  fileName: string,
  encryptedBase64: string,
): Promise<string> {
  const key = await derivePhimwarKey(fileName);

  const buffer = decodeBase64ToArrayBuffer(encryptedBase64);
  const allBytes = new Uint8Array(buffer);

  if (allBytes.length < 13) {
    throw new Error('PhimWar subtitle payload is too short to contain an IV + ciphertext');
  }

  const iv = allBytes.slice(0, 12);
  const ciphertext = allBytes.slice(12);

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plain);
}

/**
 * Convenience: derive the filename from the URL and decrypt the payload.
 */
export async function decryptPhimwarSrtFromUrl(
  url: string,
  encryptedBase64: string,
): Promise<string> {
  const fileName = getPhimwarFileName(url);
  if (!fileName) {
    throw new Error(`Cannot extract PhimWar filename from URL: ${url}`);
  }
  return decryptPhimwarSrt(fileName, encryptedBase64);
}
