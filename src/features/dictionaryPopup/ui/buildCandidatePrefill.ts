import type { LookupResult, DefinitionEntry, AudioItem, ImageItem } from '../types';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';

/**
 * Build a card-creator prefill from a candidate and the user's selections.
 * Pure function — can be used by both the React panel and the content script popup.
 */
export function buildPrefill(
  result: LookupResult,
  selectedDefinitions: readonly DefinitionEntry[],
  contextSentence: string,
  translation: string,
  audioItems: readonly AudioItem[],
  audioSelection: Map<string, boolean>,
  imageItems: readonly ImageItem[],
  imageSelection: Map<string, boolean>,
): PopupCardCreatorPrefill {
  const defs = selectedDefinitions.length > 0
    ? selectedDefinitions
    : result.definitions;

  const selectedAudios = audioItems.filter((item) => audioSelection.get(item.id) ?? item.defaultSelected);
  const selectedWordAudios = selectedAudios.filter((item) => item.kind === 'word' && item.url);
  const wordAudios = selectedWordAudios.length > 0
    ? selectedWordAudios
    : audioItems.filter((item) => item.kind === 'word' && item.url).slice(0, 1);
  const selectedSentenceAudios = selectedAudios.filter((item) => item.kind === 'sentence' && item.url);
  const sentenceAudios = selectedSentenceAudios.length > 0
    ? selectedSentenceAudios
    : audioItems.filter((item) => item.kind === 'sentence' && item.url).slice(0, 1);
  const wordAudioUrls = wordAudios.map((item) => item.url!);
  const sentenceAudioUrls = sentenceAudios.map((item) => item.url!);

  const selectedImages = imageItems.filter((item) => imageSelection.get(item.id) ?? item.defaultSelected);
  const fallbackImages = selectedImages.length > 0 ? selectedImages : imageItems.slice(0, 1);
  const imageUrls = fallbackImages.map((item) => item.src);

  return {
    term: result.term,
    langCode: result.langCode,
    reading: result.reading,
    definitions: defs.map((d) => ({ pos: d.pos, text: d.text })),
    rawDefinitions: result.rawDefinitions,
    contextSentence,
    translation: translation || undefined,
    wordAudioUrls,
    sentenceAudioUrls,
    imageUrls,
  };
}
