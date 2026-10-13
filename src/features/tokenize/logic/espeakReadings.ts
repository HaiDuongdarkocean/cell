import { espeakIpas, supportsEspeakIpa } from '@/features/pronunciation';
import type { PronunciationEngine } from '@/features/pronunciation';

/**
 * Third-tier reading source for tokenized surfaces: dictionary readings win,
 * then frequency-row readings, then eSpeak IPA for the terms still uncovered.
 * English-only (the bundled phoneme engine ships no other voices) — other
 * language profiles get an empty map and keep their own annotation.
 * Returned values are slash-wrapped to match the popup's IPA display.
 */
export async function resolveEspeakReadings(
  langCode: string,
  terms: readonly string[],
  resolved: (term: string) => string | undefined,
  engine?: PronunciationEngine,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supportsEspeakIpa(langCode)) return out;
  const uncovered = terms.filter((term) => !resolved(term));
  const ipas = await espeakIpas(uncovered, langCode, engine);
  for (const [term, ipa] of ipas) out.set(term, `/${ipa}/`);
  return out;
}
