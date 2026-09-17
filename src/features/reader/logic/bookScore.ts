


import { baseLangCode, languageMatches } from '@/shared/config/languageRegistry';
import { tokenizeTextBlock, createScoreTracker, isScorableToken, fetchTermStatuses, type ScoreTracker, type Token } from '@/features/tokenize';

const PARAGRAPHS_PER_TICK = 200;

export async function createBookScoreTracker(
  paragraphs: readonly string[],
  langCode: string,
  isCancelled: () => boolean = () => false,
): Promise<ScoreTracker | null> {
  const lang = baseLangCode(langCode);
  if (languageMatches('zh', lang)) return null;
  const tokens: Token[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    if (isCancelled()) return null;
    tokens.push(...tokenizeTextBlock(paragraphs[i]!, lang));
    if ((i + 1) % PARAGRAPHS_PER_TICK === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  if (isCancelled()) return null;
  const statuses = await fetchTermStatuses(
    lang,
    tokens.filter(isScorableToken).map((t) => t.term),
  );
  if (isCancelled() || statuses.size === 0) return null;
  return createScoreTracker(tokens, statuses, lang);
}
