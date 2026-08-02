// Pure videasy "sources-with-title" decoder.
//
// Ported from the player bundle (module 9025). The endpoint returns a
// base64url-encoded payload that is XORed with a PRNG keystream seeded by the
// per-response `seed` query parameter and the tmdbId.
//
// The decoder is intentionally self-contained: it only needs the encrypted body,
// the seed string, and the media id. No network or DOM access.

const FNV_PRIME = 16777619;
const FNV_OFFSET = 2166136261;
const HASH_INIT = 2654435769;
const ACC_INIT = 2779096485;
const MURMUL_C1 = 2246822507;
const MURMUL_C2 = 3266489909;
const MAGIC_HEADER = [109, 118, 109, 49]; // "mvm1"

// The original bundle declares both helpers, but they evaluate to constant
// true/false for integer inputs. We keep them as comments for fidelity.
// const isEvenTriangular = (n: number) => ((n * (n + 1)) & 1) === 0; // always true
// const isOddTriangular = (n: number) => ((n * (n + 1)) & 1) === 1;  // always false

function murmurMix(e: number): number {
  let n = e >>> 0;
  n ^= n >>> 16;
  n = (Math.imul(n, MURMUL_C1) >>> 0) as number;
  n ^= n >>> 13;
  n = (Math.imul(n, MURMUL_C2) >>> 0) as number;
  n ^= n >>> 16;
  return n >>> 0;
}

function rotateLeft(e: number, t: number): number {
  let n = e >>> 0;
  const shift = t & 31;
  if (shift === 0) return n >>> 0;
  return ((n << shift) | (n >>> (32 - shift))) >>> 0;
}

function fnvHash(key: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h ^ key.charCodeAt(i), FNV_PRIME) >>> 0) as number;
  }
  return murmurMix(h);
}

function seedMix(seed: string, mediaId: number): number {
  return (murmurMix(fnvHash(seed) ^ murmurMix((mediaId >>> 0) ^ HASH_INIT)) >>> 0) as number;
}

interface PrngState {
  S: number[];
  acc: number;
}

function buildPrngState(seed: string, mediaId: number): PrngState {
  const S: number[] = new Array(61);
  let a = seedMix(seed, mediaId);

  for (let i = 0; i < 8; i++) {
    // isEvenTriangular(i) is always true, so the else branch is dead.
    const index = a % 61;
    a = rotateLeft((a + HASH_INIT) >>> 0, 7 + (7 & i));
    S[index] = ((a ^ murmurMix(a)) >>> 0) as number;
    a = murmurMix((a + index) >>> 0);
  }

  return { S, acc: (murmurMix((ACC_INIT ^ a) >>> 0) >>> 0) as number };
}

function generateKeystream(state: PrngState, length: number): Uint8Array {
  const stream = new Uint8Array(length);
  let written = 0;
  let counter = 0;

  while (written < length) {
    const S = state.S;
    let acc = state.acc;
    const n = (acc % 61) as number;
    const mask = (0 - Number(String(n) in S)) >>> 0;
    const d = S[n] >>> 0;

    const mixed = (d ^ (Math.imul(HASH_INIT, counter + 1) >>> 0)) >>> 0;
    let l = (((acc ^ mixed) >>> 0) | (((acc & mixed & mask) >>> 0) as number)) >>> 0;

    const rotated = rotateLeft((l + acc) >>> 0, 31 & n) ^ rotateLeft(acc, 31 & Math.imul(n, 7));
    l = (rotated >>> 0) as number;
    acc = (murmurMix((l + HASH_INIT) >>> 0) >>> 0) as number;

    S[n] = acc >>> 0;
    state.acc = acc;

    stream[written++] = acc & 255;
    if (written < length) stream[written++] = (acc >>> 8) & 255;
    if (written < length) stream[written++] = (acc >>> 16) & 255;
    if (written < length) stream[written++] = (acc >>> 24) & 255;
    counter++;
  }

  return stream;
}

export function base64UrlToBytes(input: string): Uint8Array {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(4 * Math.ceil(input.length / 4), '=');

  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export interface VideasySource {
  readonly quality?: string;
  readonly url: string;
  readonly type?: string;
}

export interface VideasySubtitle {
  readonly lang?: string;
  readonly language?: string;
  readonly url: string;
}

export interface VideasyListing {
  readonly sources: readonly VideasySource[];
  readonly subtitles: readonly VideasySubtitle[];
}

export function decryptVideasyResponse(
  cipherBase64: string,
  seed: string,
  mediaId: number,
): VideasyListing {
  const cipher = base64UrlToBytes(cipherBase64);
  const state = buildPrngState(seed, mediaId);
  const keystream = generateKeystream(state, cipher.length);

  for (let i = 0; i < cipher.length; i++) {
    cipher[i] ^= keystream[i];
  }

  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (cipher[i] !== MAGIC_HEADER[i]) {
      throw new Error('Videasy decrypt failed: bad seed or tampered payload');
    }
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const plain = decoder.decode(cipher.subarray(MAGIC_HEADER.length));

  try {
    return JSON.parse(plain) as VideasyListing;
  } catch (err) {
    throw new Error('Videasy decrypt failed: payload is not valid JSON');
  }
}
