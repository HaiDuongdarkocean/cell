import { onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  WordStatusChangedPayloadSchema,
  WordStatusDeletedPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import { SyncDataAppliedPayloadSchema } from '@/entities/message/schema';
import {
  emitWordStatusChanged,
  emitWordStatusRemoved,
  emitWordStatusesReload,
} from './wordStatusEvents';

export function startWordStatusCrossTabRelay(): () => void {
  const listener = (message: unknown): boolean => {
    const msg = message as { type?: string; payload?: unknown };
    if (msg.type === MESSAGE_TYPES.SYNC_DATA_APPLIED) {
      const parsed = SyncDataAppliedPayloadSchema.safeParse(msg.payload);
      if (!parsed.success || !parsed.data.dataClasses.includes('wordStatus')) {
        return false;
      }
      for (const scope of parsed.data.scopes) {
        if (scope.startsWith('profile:')) emitWordStatusesReload(scope.slice(8));
      }
      return false;
    }
    if (msg.type === MESSAGE_TYPES.WORD_STATUS_CHANGED) {
      const parsed = WordStatusChangedPayloadSchema.safeParse(msg.payload);
      if (!parsed.success) {
        return false;
      }
      const { langCode, term, status } = parsed.data;
      emitWordStatusChanged({ langCode, term, status });
      return false;
    }
    if (msg.type === MESSAGE_TYPES.WORD_STATUS_DELETED) {
      const parsed = WordStatusDeletedPayloadSchema.safeParse(msg.payload);
      if (!parsed.success) {
        return false;
      }
      const { langCode, term } = parsed.data;
      emitWordStatusRemoved({ langCode, term });
      return false;
    }
    return false;
  };

  onMessage(listener);
  return () => removeOnMessageListener(listener);
}
