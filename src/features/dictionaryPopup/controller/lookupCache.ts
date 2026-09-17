import type { LookupRequest, LookupResult, WordStatus } from '@/entities/dictionary';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { nextRequestId } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import { extractWordAtOffset, WORD_CHAR_RE } from '@/features/dictionaryPopup/sentence/sentenceModule';

export interface LookupCache {
  readonly get: (term: string, langCode: string) => LookupResult[] | undefined;
  readonly has: (term: string, langCode: string) => boolean;
  readonly set: (term: string, langCode: string, results: LookupResult[]) => void;
  readonly updateStatus: (term: string, langCode: string, status: WordStatus) => void;
  readonly clear: () => void;
}

/** Bounded in-memory lookup cache. Key = `${langCode}:${term.toLowerCase()}`.
 *  Capacity scales with device memory (low-end: 50, high-end: 250) to avoid
 *  bloat on 1GB machines while still giving repeat-hover instant popups. */
export function createLookupCache(): LookupCache {
  const deviceMemory = Number((navigator as { deviceMemory?: number }).deviceMemory ?? 4);
  const MAX_LOOKUP_CACHE_SIZE = Math.min(250, Math.max(50, Math.round(deviceMemory * 25)));
  const lookupCache = new Map<string, LookupResult[]>();

  function keyFor(term: string, langCode: string): string {
    return `${langCode}:${term.toLowerCase()}`;
  }

  return {
    get(term, langCode) {
      return lookupCache.get(keyFor(term, langCode));
    },
    has(term, langCode) {
      return lookupCache.has(keyFor(term, langCode));
    },
    set(term, langCode, results) {
      const key = keyFor(term, langCode);
      // Move to most-recent position on access.
      if (lookupCache.has(key)) lookupCache.delete(key);
      lookupCache.set(key, results);
      // Evict oldest if over capacity.
      if (lookupCache.size > MAX_LOOKUP_CACHE_SIZE) {
        const first = lookupCache.keys().next().value;
        if (first) lookupCache.delete(first);
      }
    },
    updateStatus(term, langCode, status) {
      const cached = lookupCache.get(keyFor(term, langCode));
      if (cached && cached[0].status !== status) {
        lookupCache.set(keyFor(term, langCode), [{ ...cached[0], status }, ...cached.slice(1)]);
      }
    },
    clear() {
      lookupCache.clear();
    },
  };
}

/** Return the previous/next word in `sentence` relative to the current term. */
export function getAdjacentTerms(
  sentence: string,
  cursorOffset: number,
  currentTerm: string,
): { term: string; start: number }[] {
  const terms: { term: string; start: number }[] = [];

  // Previous word: scan left from cursorOffset - 1 over non-word chars.
  let i = cursorOffset - 1;
  while (i >= 0 && !WORD_CHAR_RE.test(sentence[i]!)) i--;
  if (i >= 0) {
    const prev = extractWordAtOffset(sentence, i);
    if (prev && prev.text !== currentTerm) terms.push({ term: prev.text, start: prev.start });
  }

  // Next word: scan right from the end of the current term.
  i = cursorOffset + currentTerm.length;
  while (i < sentence.length && !WORD_CHAR_RE.test(sentence[i]!)) i++;
  if (i < sentence.length) {
    const next = extractWordAtOffset(sentence, i);
    if (next && next.text !== currentTerm && !terms.some((t) => t.term === next.text)) {
      terms.push({ term: next.text, start: next.start });
    }
  }

  return terms;
}

/** Quietly lookup previous/next words so the popup is already cached when the user moves. */
export function prefetchAdjacentTerms(cache: LookupCache, request: LookupRequest): void {
  if (!request.contextSentence) return;
  const adjacent = getAdjacentTerms(request.contextSentence, request.cursorOffset, request.term);
  for (const { term, start } of adjacent) {
    if (cache.has(term, request.langCode)) continue;
    const prefetchRequest: LookupRequest = {
      term,
      langCode: request.langCode,
      contextSentence: request.contextSentence,
      cursorOffset: start,
    };
    void Promise.resolve(sendMessage({
      type: MESSAGE_TYPES.LOOKUP_REQUEST,
      payload: { requestId: nextRequestId(), request: prefetchRequest },
    }))
      .then((response: unknown) => {
        const { success, data } = response as { success: boolean; data?: LookupResult[] };
        if (success && data && data.length > 0) {
          cache.set(term, request.langCode, data);
        }
      })
      .catch(() => { /* prefetch failures are best-effort */ });
  }
}
