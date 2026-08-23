import type { Token } from '@/features/tokenize/types';

export function getSentenceText(
  tokens: readonly Token[],
  text: string,
  sentenceIndex: number,
): string {
  const sentenceTokens = tokens.filter((t) => t.sentenceIndex === sentenceIndex);
  if (sentenceTokens.length === 0) return text;
  const start = sentenceTokens[0].start;
  let end = sentenceTokens[sentenceTokens.length - 1].end;
  while (end < text.length && /[.!?]/.test(text[end]!)) {
    end++;
  }
  return text.slice(start, end).trimStart();
}
