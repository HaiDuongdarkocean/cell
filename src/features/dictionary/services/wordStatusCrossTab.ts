import { onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  WordStatusChangedPayloadSchema,
  WordStatusDeletedPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import { emitWordStatusChanged, emitWordStatusRemoved } from './wordStatusEvents';

export function startWordStatusCrossTabRelay(): () => void {
  const listener = (message: unknown): boolean => {
    const msg = message as { type?: string; payload?: unknown };
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
