import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { t } from '@/shared/i18n';
import type { DictionaryPanelPrefill } from '@/entities/dictionary';
import type { MiningQueueItem } from '@/entities/miningQueue';
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

export type QueueQuickAddDestination = 'anki' | 'ocean-srs';

export async function queueQuickAddDestination(): Promise<QueueQuickAddDestination> {
  const settings = await loadSettings();
  return settings.dictionaryPopup?.srsDestination ?? 'anki';
}

/** Ocean SRS path stays dialog-free. Anki rows instead replay through
 *  `sendToCard` + `initialAction: 'quick-add'` (spec REQ-5) so the integrated
 *  card creator builds fields and auto-submits on the standard path. */
export async function quickAddQueueItemToSrs(
  item: MiningQueueItem,
  addToSrs: OceanSrsAdder,
): Promise<void> {
  const prefill = item.snapshot;
  if (!prefill) throw new Error(t('queue.error.action', ['missing snapshot']));
  await addToSrs(prefill);
}
