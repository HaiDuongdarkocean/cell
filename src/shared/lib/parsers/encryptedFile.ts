import type { SubtitleFormat } from '@/entities/media';
import { formatFromContent } from './subtitleFormat';

export interface EncryptedFileSpec {
  readonly prefix: string;
  readonly key: string;
  readonly algorithm: 'rc4-hex';
}

const KNOWN_SPECS: readonly EncryptedFileSpec[] = [
  {
    prefix: 'HUBPHIM_ENC:',
    key: 'hubphim_sub_secret_key_2026',
    algorithm: 'rc4-hex',
  },
];

function rc4HexDecrypt(body: string, prefix: string, key: string): string {
  if (!body.startsWith(prefix)) return body;
  const hex = body.slice(prefix.length);
  if (hex.length === 0) return '';
  if (hex.length % 4 !== 0) {
    throw new Error('Encrypted payload length is not a multiple of 4 hex chars');
  }

  let encoded = '';
  for (let i = 0; i < hex.length; i += 4) {
    const q = hex.slice(i, i + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(q)) {
      throw new Error('Invalid hex quartet in encrypted payload');
    }
    const code = parseInt(q, 16);
    encoded += String.fromCharCode(code);
  }

  const S = new Array<number>(256);
  for (let i = 0; i < 256; i++) S[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }

  let i = 0;
  j = 0;
  let plain = '';
  for (let n = 0; n < encoded.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    const k = S[(S[i] + S[j]) & 0xff];
    plain += String.fromCharCode(encoded.charCodeAt(n) ^ k);
  }

  return plain;
}

function decryptWithSpec(body: string, spec: EncryptedFileSpec): string {
  if (spec.algorithm === 'rc4-hex') {
    return rc4HexDecrypt(body, spec.prefix, spec.key);
  }
  throw new Error(`Unsupported encrypted-file algorithm: ${spec.algorithm}`);
}

/** Check whether a response body is a known encrypted-file payload. */
export function isEncryptedFileContent(body: string): boolean {
  return KNOWN_SPECS.some((spec) => body.startsWith(spec.prefix));
}

/**
 * Decrypt an encrypted-file body if a known spec matches.
 * Returns `null` when the body is not a recognized encrypted payload.
 */
export function maybeDecryptEncryptedFile(body: string): string | null {
  const spec = KNOWN_SPECS.find((s) => body.startsWith(s.prefix));
  if (!spec) return null;
  return decryptWithSpec(body, spec);
}

/**
 * Decrypt a body if needed and sniff the subtitle format from the result.
 * Returns `{ content, format }` where `content` is the decrypted/plaintext body.
 */
export function decryptAndDetectFormat(body: string): { content: string; format: SubtitleFormat | null } {
  const decrypted = maybeDecryptEncryptedFile(body) ?? body;
  return { content: decrypted, format: formatFromContent(decrypted) };
}
