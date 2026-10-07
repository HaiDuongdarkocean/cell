import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { t } from '@/shared/i18n';
import type { DictionaryPanelPrefill } from '@/entities/dictionary';
import type { MiningQueueItem } from '@/entities/miningQueue';
import { formatDefinitions } from '@/features/dictionary';
import type { AnkiTextFields, AnkiMediaFields } from '@/features/cardCreator';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';
import type { SrsAddNoteResult } from '@/entities/message/types';

export type OceanSrsAdder = (prefill: PopupCardCreatorPrefill) => Promise<SrsAddNoteResult>;

export function queueItemToPrefill(item: MiningQueueItem): DictionaryPanelPrefill {
  const base = item.snapshot ?? {
    term: item.term ?? '',
    langCode: item.langCode,
    pos: item.pos,
    reading: '',
    definitions: [],
    rawDefinitions: [],
    contextSentence: item.sentence,
    translation: item.translation,
  };
  return { ...base, term: item.term ?? (base.term || undefined), queueItemId: item.id };
}

async function quickAddToAnki(
  item: MiningQueueItem,
  warn: (message: string) => void,
): Promise<void> {
  const prefill = item.snapshot;
  if (!prefill) throw new Error(t('queue.error.action', ['missing snapshot']));

  // Lazy-load cardCreator internals — the queue surface should not drag the
  // Anki dialog stack into subtitle/local-player bundles on cold start.
  const {
    listModelFields,
    resolveFieldMapping,
    quickAddNote,
    fetchMediaList,
  } = await import('@/features/cardCreator');

  const settings = await loadSettings();
  const { ankiConnectUrl, defaultDeck, defaultNoteType, defaultTags, fieldMappings } =
    settings.cardCreator;
  const fields = await listModelFields(ankiConnectUrl, defaultNoteType);
  if (!fields.ok) throw new Error(fields.error);
  const { mapping } = resolveFieldMapping(fields.value, fieldMappings?.[defaultNoteType]);

  const text: AnkiTextFields = {
    targetWord: prefill.term,
    sentence: prefill.contextSentence,
    sentenceTranslation: prefill.translation ?? '',
    definitions: formatDefinitions(prefill.definitions),
    note: '',
    moreExample: '',
  };
  const [images, sentenceAudios, wordAudios] = await Promise.all([
    fetchMediaList(prefill.imageUrls ?? [], 'images', warn),
    fetchMediaList(prefill.sentenceAudioUrls ?? [], 'sentenceAudios', warn),
    fetchMediaList(prefill.wordAudioUrls ?? [], 'wordAudios', warn),
  ]);
  const media: AnkiMediaFields = { images, sentenceAudios, wordAudios };

  const result = await quickAddNote(
    ankiConnectUrl,
    defaultDeck,
    defaultNoteType,
    mapping,
    defaultTags,
    text,
    media,
    warn,
  );
  if (!result.ok) throw new Error(result.error);
  if (result.noteId === null) throw new Error(t('queue.error.action', ['duplicate note']));
}

export type QueueQuickAddDestination = 'anki' | 'ocean-srs';

export async function quickAddQueueItem(
  item: MiningQueueItem,
  warn: (message: string) => void,
  addToSrs: OceanSrsAdder,
): Promise<QueueQuickAddDestination> {
  const settings = await loadSettings();
  const destination = settings.dictionaryPopup?.srsDestination ?? 'anki';
  if (destination === 'ocean-srs') {
    const prefill = item.snapshot;
    if (!prefill) throw new Error(t('queue.error.action', ['missing snapshot']));
    await addToSrs(prefill);
    return destination;
  }
  await quickAddToAnki(item, warn);
  return destination;
}
