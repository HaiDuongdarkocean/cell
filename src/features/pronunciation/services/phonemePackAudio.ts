import { getURL } from '@/shared/lib/chrome-apis/runtime';
import { decodeBase64ToArrayBuffer } from '@/shared/lib/base64';
import type { PronunciationAudio } from '../types';
import { decodeAudioUrl } from './audioDecoder';
import { synthesizeEspeakPhonemeAudio } from './espeakPhonemeAudio';
import { normalizeAccent, resolvePhonemeFile, type PhonemeAccent, type PhonemePack } from './phonemePack';
import { listPhonemePacks, getPhonemePack, type StorageArea } from './phonemePackStorage';

const PACK_DIR = 'pronunciation/phonemes/';

let builtinPackPromise: Promise<PhonemePack | null> | null = null;
let customPacksPromise: Promise<readonly { id: string; pack: PhonemePack }[]> | null = null;

/** Bundled pack manifest — fetched once per session. */
export function loadBuiltinPhonemePack(): Promise<PhonemePack | null> {
  if (typeof fetch !== 'function') return Promise.resolve(null);
  if (!builtinPackPromise) {
    builtinPackPromise = fetch(getURL(`${PACK_DIR}manifest.json`))
      .then((r) => (r.ok ? (r.json() as Promise<PhonemePack>) : null))
      .catch(() => null);
  }
  return builtinPackPromise;
}

/** Imported packs in resolve order — newest import wins per symbol. */
function loadCustomPacks(
  storage?: StorageArea | null,
): Promise<readonly { id: string; pack: PhonemePack }[]> {
  if (!customPacksPromise || storage) {
    customPacksPromise = (async () => {
      const metas = await listPhonemePacks(storage);
      const packs = await Promise.all(metas.map(async (m) => ({ id: m.id, pack: await getPhonemePack(m.id, storage) })));
      return packs.filter((p): p is { id: string; pack: PhonemePack } => p.pack !== null).reverse();
    })();
  }
  return customPacksPromise;
}

/** Call after importing/removing a pack so resolution picks it up. */
export function invalidatePhonemePacks(): void {
  customPacksPromise = null;
}

const audioCache = new Map<string, Promise<PronunciationAudio | null>>();

function decodePackAudio(
  cacheKey: string,
  loader: () => Promise<PronunciationAudio>,
): Promise<PronunciationAudio | null> {
  let pending = audioCache.get(cacheKey);
  if (!pending) {
    pending = loader().catch(() => null);
    audioCache.set(cacheKey, pending);
  }
  return pending;
}

function decodeBase64Audio(b64: string): Promise<PronunciationAudio> {
  const url = URL.createObjectURL(
    new Blob([decodeBase64ToArrayBuffer(b64)], { type: 'audio/ogg' }),
  );
  return decodeAudioUrl(url, 'localFile').finally(() => URL.revokeObjectURL(url));
}

function espeakVoice(accent: PhonemeAccent | null, langCode: string): string {
  return accent === 'us' ? 'en-us' : langCode;
}

/**
 * Resolve a phoneme click to audio: custom packs (plugin layer) → bundled
 * pack → eSpeak `[[mnemonic]]` fallback with the accent-matched voice.
 * `accentLabel` is the dictionary's free-text accent ('AmE', 'BrE'…).
 * `langCode` keeps the eSpeak gate honest for non-English profiles.
 */
export async function resolvePhonemeAudio(
  ipa: string,
  accentLabel: string | undefined,
  langCode: string,
  storage?: StorageArea | null,
): Promise<PronunciationAudio | null> {
  const accent = normalizeAccent(accentLabel);

  const custom = await loadCustomPacks(storage);
  for (const { id, pack } of custom) {
    const b64 = resolvePhonemeFile(pack.files, ipa, accent);
    if (b64) return decodePackAudio(`custom:${id}:${accent}:${ipa}`, () => decodeBase64Audio(b64));
  }

  const builtin = await loadBuiltinPhonemePack();
  const file = builtin ? resolvePhonemeFile(builtin.files, ipa, accent) : null;
  if (file) {
    return decodePackAudio(`builtin:${accent}:${ipa}`, () =>
      decodeAudioUrl(getURL(`${PACK_DIR}${file}`), 'localFile'));
  }

  return synthesizeEspeakPhonemeAudio(ipa, espeakVoice(accent, langCode));
}
