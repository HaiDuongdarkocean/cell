import { onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { messagePayload } from '@/entities/message/payload';
import type { SyncDataAppliedPayload } from '@/entities/message/schema';
import type { WordStatusChangedPayload } from '@/entities/message';
import {
  emitWordStatusChanged,
  emitWordStatusRemoved,
  emitWordStatusesReload,
} from './wordStatusEvents';

export function startWordStatusCrossTabRelay(): () => void {
  const listener = (message: unknown): boolean => {
    const applied = messagePayload<SyncDataAppliedPayload>(message, MESSAGE_TYPES.SYNC_DATA_APPLIED);
    if (applied && applied.dataClasses.includes('wordStatus')) {
      for (const scope of applied.scopes) {
        if (scope.startsWith('profile:')) emitWordStatusesReload(scope.slice(8));
      }
      return false;
    }
    const changed = messagePayload<WordStatusChangedPayload>(message, MESSAGE_TYPES.WORD_STATUS_CHANGED);
    if (changed) {
      emitWordStatusChanged({ langCode: changed.langCode, term: changed.term, status: changed.status });
      return false;
    }
    const deleted = messagePayload<{ langCode: string; term: string }>(message, MESSAGE_TYPES.WORD_STATUS_DELETED);
    if (deleted) {
      emitWordStatusRemoved({ langCode: deleted.langCode, term: deleted.term });
      return false;
    }
    return false;
  };

  onMessage(listener);
  return () => removeOnMessageListener(listener);
}
