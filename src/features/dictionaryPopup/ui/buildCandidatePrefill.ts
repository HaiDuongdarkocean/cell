import type { LookupResult, DefinitionEntry, AudioItem, ImageItem, PopupCardCreatorPrefill, PosVariant } from '@/entities/dictionary';
import { getSelectedExamples, getSelectedSubsenseExamples, getSelectedSubsenseIndexes, toSelectedExampleIds } from '../logic/definitionSelection';
import type { DefinitionSelection, ExampleSelection } from '../logic/definitionSelection';

/**
 * Build a card-creator prefill from a candidate and the user's selections.
 * Pure function — can be used by both the React panel and the content script popup.
 * A def ships when it or one of its subsenses is checked; `subsenses` carries
 * only the checked subsenses (each with its own examples/relations) so a
 * child pick always ships its parent as context, never a merged gloss.
 */
export function buildPrefill(
  result: LookupResult,
  selectedDefinitions: readonly DefinitionEntry[],
  exampleSelection: ExampleSelection,
  definitionSelection: DefinitionSelection | undefined,
  contextSentence: string,
  translation: string,
  audioItems: readonly AudioItem[],
  audioSelection: Map<string, boolean>,
  imageItems: readonly ImageItem[],
  imageSelection: Map<string, boolean>,
  translationSelected = false,
  variant?: { readonly variant: PosVariant; readonly accentIndex: number },
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
    reading: variant ? (variant.variant.prons[variant.accentIndex]?.ipa ?? result.reading) : result.reading,
    readingKind: result.readingKind,
    ...(variant?.variant.pos ? { pos: variant.variant.pos } : {}),
    definitions: defs.map((d) => {
      const subIndexes = definitionSelection ? getSelectedSubsenseIndexes(d, definitionSelection) : [];
      return {
        pos: d.pos,
        labels: d.labels,
        level: d.level,
        text: d.text,
        subsenses: subIndexes.length
          ? subIndexes.map((i) => {
              const sub = d.subsenses![i]!;
              return { ...sub, selectedExamples: getSelectedSubsenseExamples(d, sub, i, exampleSelection) };
            })
          : undefined,
        synonyms: d.synonyms,
        antonyms: d.antonyms,
        synonymGroups: d.synonymGroups,
        selectedExamples: getSelectedExamples(d, exampleSelection),
      };
    }),
    rawDefinitions: result.rawDefinitions,
    contextSentence,
    translation: translation || undefined,
    wordAudioUrls,
    sentenceAudioUrls,
    imageUrls,
    // Full lookup result + media arrays for the integrated Dictionary clone:
    // the left pane can re-render the exact candidate and its loaded tabs.
    lookupResult: result,
    frequencies: variant ? variant.variant.frequencies : result.frequencies,
    frequencyStars: variant ? variant.variant.frequencyStars : result.frequencyStars,
    audioItems,
    imageItems,
    selectedDefinitionIds: definitionSelection
      ? [...definitionSelection.keys()].filter((k) => definitionSelection.get(k) === true)
      : defs.map((d) => d.id),
    selectedExampleIds: toSelectedExampleIds(defs, exampleSelection),
    selectedAudioIds: effectiveAudios.map((item) => item.id),
    selectedImageIds: fallbackImages.map((item) => item.id),
    translationSelected,
  };
}
