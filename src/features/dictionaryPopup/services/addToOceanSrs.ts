import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/types';
import type { SrsFieldValue } from '@/entities/srs/types';
import type { MessageResponse, SrsAddNotePayload, SrsAddNoteResult } from '@/entities/message/types';

/**
 * Build a default Ocean SRS field record from a popup prefill.
 *
 * V1 assumes the default notetype field ids (target, ipa, sentence, def,
 * wordAudio, sentAudio, image, examples, notes, translation, context).
 * Extra fields are included so the background can pick whatever the active
 * notetype defines.
 */
export function buildSrsFieldsFromPrefill(prefill: PopupCardCreatorPrefill): Record<string, SrsFieldValue> {
  const fields: Record<string, SrsFieldValue> = {};

  fields['target'] = { kind: 'text', value: prefill.term };
  if (prefill.reading) fields['ipa'] = { kind: 'text', value: prefill.reading };
  if (prefill.contextSentence) {
    fields['sentence'] = { kind: 'text', value: prefill.contextSentence };
    fields['context'] = { kind: 'context', value: prefill.contextSentence };
  }
  if (prefill.definitions.length) {
    const first = prefill.definitions[0];
    fields['def'] = { kind: 'text', value: first.text };
    fields['examples'] = { kind: 'list', value: prefill.definitions.map((d) => d.text) };
  }
  if (prefill.wordAudioUrls?.length) {
    fields['wordAudio'] = { kind: 'audio', value: prefill.wordAudioUrls[0]!, source: 'pronunciation' };
  }
  if (prefill.sentenceAudioUrls?.length) {
    fields['sentAudio'] = { kind: 'audio', value: prefill.sentenceAudioUrls[0]!, source: 'tts' };
  }
  if (prefill.imageUrls?.length) {
    fields['image'] = { kind: 'image', value: prefill.imageUrls[0]! };
  }
  if (prefill.translation) fields['translation'] = { kind: 'translation', value: prefill.translation };
  fields['notes'] = { kind: 'text', value: '' };

  return fields;
}

/** Add a popup prefill to Ocean SRS. Returns the created note/card ids. */
export async function addToOceanSrs(prefill: PopupCardCreatorPrefill): Promise<SrsAddNoteResult> {
  const payload: SrsAddNotePayload = {
    targetLanguage: prefill.langCode,
    targetWord: prefill.term,
    fields: buildSrsFieldsFromPrefill(prefill),
  };
  const response = await sendMessage<MessageResponse<SrsAddNoteResult>>({
    type: MESSAGE_TYPES.SRS_ADD_NOTE,
    payload,
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.error ?? 'SRS add note failed');
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
