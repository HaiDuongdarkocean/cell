// answerCache — per-browser-tab AI answer cache (spec ai-bridge-dictionary REQ-10).
//
// Module-level Map lives in the content-script world of the host tab: popup
// close/open and tab switches inside the page reuse it; it dies with the tab,
// which is the required lifetime. Key embeds feature + provider + full prompt
// (prompt already carries term, sentence, and languages), so the same term in
// the same sentence hits; a different sentence or provider misses.

import type { AiFeature, AiProviderId } from '@/entities/settings';

export interface CachedAiAnswer {
  readonly feature: AiFeature;
  readonly provider: AiProviderId;
  readonly text: string;
}

const MAX_ENTRIES = 200;
const cache = new Map<string, CachedAiAnswer>();

export function aiAnswerCacheKey(feature: AiFeature, provider: AiProviderId | undefined, prompt: string): string {
  return `${feature}|${provider ?? ''}|${prompt}`;
}

export function getAiAnswer(key: string): CachedAiAnswer | undefined {
  return cache.get(key);
}

export function setAiAnswer(key: string, answer: CachedAiAnswer): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    cache.delete(cache.keys().next().value!);
  }
  cache.set(key, answer);
}

export function clearAiAnswerCache(): void {
  cache.clear();
}
