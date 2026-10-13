import type { PronunciationAudio } from '../types';
import { synthesizeEspeakAudio } from './espeakWordAudio';
import { trimAndNormalizePcm } from './espeakPcm';

// IPA → eSpeak phoneme input for the bundled 'en' voice. `[[...]]` is the
// official phoneme-input syntax; the vendored asm.js worker enables
// espeakPHONEMES whenever the input text begins with `[[`.
//
// Voiced stops and most consonants render SILENT or near-silent when isolated
// (eSpeak only voices a stop through its transition into a following vowel),
// so every consonant gets a trailing schwa: `[[b@]]` → "buh". Vowels and
// diphthongs are syllabic and stay bare `[[V]]`. eSpeak never reads raw IPA —
// unmapped symbols return null.
const IPA_TO_ESPEAK: Readonly<Record<string, string>> = {
  p: '[[p@]]', b: '[[b@]]', t: '[[t@]]', d: '[[d@]]', k: '[[k@]]',
  'ɡ': '[[g@]]',
  'tʃ': '[[tS@]]', 'dʒ': '[[dZ@]]',
  f: '[[f@]]', v: '[[v@]]', 'θ': '[[T@]]', 'ð': '[[D@]]', s: '[[s@]]',
  z: '[[z@]]', 'ʃ': '[[S@]]', 'ʒ': '[[Z@]]', h: '[[h@]]', x: '[[x@]]',
  m: '[[m@]]', n: '[[n@]]', 'ŋ': '[[N@]]', l: '[[l@]]',
  r: '[[r@]]', 'ɹ': '[[r@]]', 'ɾ': '[[d@]]', j: '[[j@]]', w: '[[w@]]',
  'ɪ': '[[I]]', e: '[[e]]', 'ɛ': '[[E]]', 'æ': '[[a]]',
  'ɒ': '[[Q]]', 'ɑ': '[[A:]]', 'ɔ': '[[O]]', 'ʊ': '[[U]]',
  'ʌ': '[[V]]', 'ə': '[[@]]', 'ɜ': '[[3]]', 'ɐ': '[[@]]',
  i: '[[i]]', u: '[[u]]',
  'iː': '[[i:]]', 'uː': '[[u:]]', 'ɑː': '[[A:]]', 'ɔː': '[[O:]]',
  'ɜː': '[[3:]]',
  'eɪ': '[[eI]]', 'aɪ': '[[aI]]', 'ɔɪ': '[[OI]]',
  'əʊ': '[[@U]]', 'oʊ': '[[oU]]', 'aʊ': '[[aU]]',
  'ɪə': '[[I@]]', 'eə': '[[e@]]', 'ʊə': '[[U@]]',
  'ɚ': '[[@r]]', 'ɝ': '[[3:]]', 'ɝː': '[[3:]]',
};

// Slower than word TTS (175 wpm): an isolated sound is clearer when stretched.
const PHONEME_RATE = 140;

export function espeakPhonemeInput(ipa: string): string | null {
  return IPA_TO_ESPEAK[ipa] ?? null;
}

const cache = new Map<string, Promise<PronunciationAudio | null>>();

/**
 * Synthesize one IPA phoneme as an isolated eSpeak clip — the whole buffer is
 * the phoneme in its minimal context, then trimmed and normalized so every
 * chip plays at the same loudness. Returns null for symbols without an eSpeak
 * mnemonic or when synthesis is unavailable. Cached per (ipa, langCode).
 */
export function synthesizeEspeakPhonemeAudio(
  ipa: string,
  langCode: string,
): Promise<PronunciationAudio | null> {
  const key = `${langCode}:${ipa}`;
  let pending = cache.get(key);
  if (!pending) {
    const input = espeakPhonemeInput(ipa);
    pending = input
      ? synthesizeEspeakAudio(input, langCode, PHONEME_RATE).then((audio) => {
          if (!audio) return null;
          const samples = trimAndNormalizePcm(audio.samples, audio.sampleRate);
          return { ...audio, samples, duration: samples.length / audio.sampleRate };
        })
      : Promise.resolve(null);
    cache.set(key, pending);
  }
  return pending;
}
