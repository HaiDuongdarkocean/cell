import type { LookupResult, DefinitionEntry, AudioItem, ImageItem, PopupCardCreatorPrefill } from '@/entities/dictionary';

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
  translationSelected = false,
): PopupCardCreatorPrefill {
  const defs = selectedDefinitions.length > 0
    ? selectedDefinitions
    : result.definitions;

  const selectedAudios = audioItems.filter((item) => audioSelection.get(item.id) ?? item.defaultSelected);
  const selectedWordAudios = selectedAudios.filter((item) => item.kind === 'word' && (item.url || item.audioBytes));
  const wordAudios = selectedWordAudios.length > 0
    ? selectedWordAudios
    : audioItems.filter((item) => item.kind === 'word' && (item.url || item.audioBytes)).slice(0, 1);
  const selectedSentenceAudios = selectedAudios.filter((item) => item.kind === 'sentence' && (item.url || item.audioBytes));
  const sentenceAudios = selectedSentenceAudios.length > 0
    ? selectedSentenceAudios
    : audioItems.filter((item) => item.kind === 'sentence' && (item.url || item.audioBytes)).slice(0, 1);
  const wordAudioUrls = wordAudios.map((item) => item.url ?? `audio-bytes://${item.id}`);
  const sentenceAudioUrls = sentenceAudios.map((item) => item.url ?? `audio-bytes://${item.id}`);

  const selectedImages = imageItems.filter((item) => imageSelection.get(item.id) ?? item.defaultSelected);
  const fallbackImages = selectedImages.length > 0 ? selectedImages : imageItems.slice(0, 1);
  const imageUrls = fallbackImages.map((item) => item.src);

  const effectiveAudios = [...wordAudios, ...sentenceAudios];

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
    // Full lookup result + media arrays for the integrated Dictionary clone:
    // the left pane can re-render the exact candidate and its loaded tabs.
    lookupResult: result,
    audioItems,
    imageItems,
    selectedDefinitionIds: defs.map((d) => d.id),
    selectedAudioIds: effectiveAudios.map((item) => item.id),
    selectedImageIds: fallbackImages.map((item) => item.id),
    translationSelected,
  };
}
