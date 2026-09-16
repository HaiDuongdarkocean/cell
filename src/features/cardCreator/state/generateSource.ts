import type { CardCreatorPrefill } from '../types';

export function isPrefillUsableForTerm(
  prefill: CardCreatorPrefill | undefined,
  targetWord: string,
): boolean {
  if (!prefill) return false;
  if (!targetWord) return true;
  const prefillTerm = prefill.targetWord?.trim();
  return !!prefillTerm && prefillTerm.toLowerCase() === targetWord.toLowerCase();
}

export function generateSourceKey(sourceLang: string, targetWord: string): string {
  return `${sourceLang}:${targetWord.toLowerCase()}`;
}

export function hasGenerateSourceData(source: CardCreatorPrefill): boolean {
  return (
    !!source.definitions?.trim() ||
    (source.wordAudioUrls?.length ?? 0) > 0 ||
    (source.sentenceAudioUrls?.length ?? 0) > 0 ||
    (source.imageUrls?.length ?? 0) > 0
  );
}
