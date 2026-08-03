// Pure peachify (eat-peach.sbs) AES-GCM decoder.
//
// The peachify API returns `{ isEncrypted: true, data: "iv.ciphertext.authTag" }`
// where each part is base64url-encoded. AES-GCM expects ciphertext + authTag
// concatenated. The key is a fixed hex string (base64-encoded in source).

export interface PeachifySubtitle {
  readonly url?: string;
  readonly file?: string;
  readonly src?: string;
  readonly label?: string;
  readonly name?: string;
  readonly language?: string;
  readonly langCode?: string;
  readonly lang?: string;
}

export interface PeachifySource {
  readonly url?: string;
  readonly src?: string;
  readonly file?: string;
  readonly type?: string;
  readonly quality?: string | number;
}

export interface PeachifyListing {
  readonly sources?: readonly PeachifySource[];
  readonly subtitles?: readonly PeachifySubtitle[];
}

// Key: base64("a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5d")
const ENCRYPTION_KEY_HEX = atob(
  'YThmMmExYjVlOWM0NzA4MTRmNmIyYzNhNWQ4ZTdmOWMxYTJiM2M0ZDVlM2Y3YThiOGNhZDFlMmQwYTRkNWM1ZA==',
);

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function importKey(): Promise<CryptoKey> {
  const keyBytes = hexToBytes(ENCRYPTION_KEY_HEX);
  return crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function decryptPeachifyResponse(payload: string): Promise<PeachifyListing> {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Peachify decrypt failed: expected iv.ciphertext.authTag');

  const [ivPart, ciphertextPart, authTagPart] = parts;
  const iv = base64UrlToBytes(ivPart);
  const ciphertext = base64UrlToBytes(ciphertextPart);
  const authTag = base64UrlToBytes(authTagPart);

  const encrypted = new Uint8Array(ciphertext.length + authTag.length);
  encrypted.set(ciphertext);
  encrypted.set(authTag, ciphertext.length);

  const key = await importKey();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, encrypted.buffer as ArrayBuffer);
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json) as PeachifyListing;
}
