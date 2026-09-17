import { getWordStatuses } from '@/features/dictionary';
import type { WordStatus } from '@/entities/dictionary';

const MAX_TERMS_PER_REQUEST = 1000;
const MAX_TERM_LENGTH = 200;

export async function fetchTermStatuses(
  langCode: string,
  terms: Iterable<string>,
): Promise<Map<string, WordStatus>> {
  const clean = [...new Set(terms)].filter((t) => t.length <= MAX_TERM_LENGTH);
  const merged = new Map<string, WordStatus>();
  for (let i = 0; i < clean.length; i += MAX_TERMS_PER_REQUEST) {
    const batch = await getWordStatuses(langCode, clean.slice(i, i + MAX_TERMS_PER_REQUEST));
    if (batch.size === 0) return new Map();
    for (const [term, status] of batch) merged.set(term, status);
  }
  return merged;
}
