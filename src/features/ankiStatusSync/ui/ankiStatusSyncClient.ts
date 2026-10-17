import { MESSAGE_TYPES } from '@/shared/config/messages';
import { requestMessage } from '@/shared/lib/chrome-apis/runtime';
import type { AnkiStatusSyncView } from '@/entities/ankiStatusSync';
import type { CardSourceTerms } from '../service/statusSyncService';
import { normalizeLangCode } from '@/features/dictionary';

export function runAnkiSyncNow(): Promise<AnkiStatusSyncView> {
  return requestMessage<AnkiStatusSyncView>(MESSAGE_TYPES.ANKI_STATUS_SYNC_RUN, {});
}

export function getAnkiSyncState(): Promise<AnkiStatusSyncView> {
  return requestMessage<AnkiStatusSyncView>(MESSAGE_TYPES.ANKI_STATUS_SYNC_STATE, {});
}

export function getCardSourceTerms(langCode: string): Promise<CardSourceTerms> {
  return requestMessage<CardSourceTerms>(MESSAGE_TYPES.ANKI_STATUS_CARD_TERMS, { langCode: normalizeLangCode(langCode) });
}
