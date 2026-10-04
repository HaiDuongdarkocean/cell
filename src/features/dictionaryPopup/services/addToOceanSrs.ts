import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { t } from '@/shared/i18n';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { formatDefinitions } from '@/features/dictionary'
import { formatDefEntry, formatDefFromLookup } from '@/features/srs';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';
import type { SrsFieldValue } from '@/entities/srs/types';
import type { MessageResponse, SrsAddNotePayload, SrsAddNoteResult } from '@/entities/message/types';

/**
 * Build a default Ocean SRS field record from a popup prefill.
 *
 * V1 assumes the default notetype field ids (target, sentence, def,
 * wordAudio, sentAudio, image, examples, notes, translation).
 * Extra fields are included so the background can pick whatever the active
 * notetype defines.
 */
export function buildSrsFieldsFromPrefill(
  prefill: PopupCardCreatorPrefill,
  frequencyFormat: 'stars' | 'rank' = 'stars',
): Record<string, SrsFieldValue> {
  const fields: Record<string, SrsFieldValue> = {};

  fields['target'] = { kind: 'text', value: prefill.term };
  if (prefill.contextSentence) {
    fields['sentence'] = { kind: 'text', value: prefill.contextSentence };
  }
  if (prefill.definitions.length) {
    const senses = formatDefinitions(prefill.definitions);
    fields['def'] = {
      kind: 'text',
      value: prefill.lookupResult
        ? formatDefFromLookup(prefill.lookupResult, senses, prefill.term, frequencyFormat)
        : formatDefEntry({ term: prefill.term, reading: prefill.reading, readingKind: prefill.readingKind, frequencyFormat, senses }),
    };
  }
  if (prefill.wordAudioUrls?.length) {
    fields['wordAudio'] = { kind: 'audio', value: prefill.wordAudioUrls, source: 'pronunciation' };
  }
  if (prefill.sentenceAudioUrls?.length) {
    fields['sentAudio'] = { kind: 'audio', value: prefill.sentenceAudioUrls, source: 'tts' };
  }
  if (prefill.imageUrls?.length) {
    fields['image'] = { kind: 'image', value: prefill.imageUrls };
  }
  if (prefill.translation) fields['translation'] = { kind: 'translation', value: prefill.translation };
  fields['notes'] = { kind: 'text', value: '' };

  return fields;
}

/** Add a popup prefill to Ocean SRS. Returns the created note/card ids. */
export async function addToOceanSrs(prefill: PopupCardCreatorPrefill): Promise<SrsAddNoteResult> {
  const settings = await loadSettings().catch(() => undefined);
  const payload: SrsAddNotePayload = {
    targetLanguage: prefill.langCode,
    targetWord: prefill.term,
    fields: buildSrsFieldsFromPrefill(prefill, settings?.cardCreator?.frequencyDisplay),
  };
  const response = await sendMessage<MessageResponse<SrsAddNoteResult>>({
    type: MESSAGE_TYPES.SRS_ADD_NOTE,
    payload,
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.error ?? t('dict.error.srs'));
  }
  return response.data;
}

/** Open the srs-study page so the user can review the newly added word. */
export async function openSrsStudyPage(): Promise<void> {
  await sendMessage({
    type: MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE,
    payload: {},
  });
}
