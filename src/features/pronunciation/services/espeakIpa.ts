import { pronunciationEngine } from './pronunciationEngineSingleton';
import type { PronunciationEngine } from './pronunciationEngine';

/**
 * eSpeak-phonemes ships English voices only ('en' | 'en-us'), so the IPA
 * fallback can only produce output for English language profiles.
 */
export function supportsEspeakIpa(langCode: string): boolean {
  return langCode.split('-')[0]?.toLowerCase() === 'en';
}

/**
 * Resolve eSpeak IPA for a batch of terms. Returns a sparse map — terms the
 * engine cannot pronounce are absent so callers can keep their own fallback.
 * The engine lazy-loads the bundled WASM on first call and reuses it after.
 */
export async function espeakIpas(
  terms: readonly string[],
  langCode: string,
  engine: PronunciationEngine = pronunciationEngine,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supportsEspeakIpa(langCode) || terms.length === 0) return out;
  for (const term of terms) {
    try {
      const { ipa } = await engine.toPronunciation(term, langCode);
      if (ipa) out.set(term, ipa);
    } catch {
      // per-term failure stays absent — callers render without a reading
    }
  }
  return out;
}
