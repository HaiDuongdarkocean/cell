// dictionaryCrossTab — relays cross-context dictionary-corpus signals into the
// context-local dictionaryEvents emitter, mirroring wordStatusCrossTab.
// Two sources: DICTIONARY_CHANGED broadcasts (background fans out on resource
// mutations/jobs) and SYNC_DATA_APPLIED carrying dictResource (another device
// pushed dictionary resources). Mutations originating in this context already
// emit via resourceClient.notifyResourcesChanged → emitDictionaryChanged.

import { onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { messagePayload } from '@/entities/message/payload';
import type { SyncDataAppliedPayload } from '@/entities/message/schema';
import { emitDictionaryChanged } from './dictionaryEvents';

export function startDictionaryCrossTabRelay(): () => void {
  const listener = (message: unknown): boolean => {
    const applied = messagePayload<SyncDataAppliedPayload>(message, MESSAGE_TYPES.SYNC_DATA_APPLIED);
    if (applied && applied.dataClasses.includes('dictResource')) {
      const langs = applied.scopes
        .filter((scope) => scope.startsWith('profile:'))
        .map((scope) => scope.slice(8));
      // Global-scope dict changes (no profile: scope) still invalidate — emit
      // with an empty langCode so consumers treat it as "all languages".
      if (langs.length === 0) emitDictionaryChanged({ langCode: '', reason: 'sync' });
      for (const langCode of langs) emitDictionaryChanged({ langCode, reason: 'sync' });
      return false;
    }
    const changed = messagePayload<{ reason: string; langCode?: string }>(
      message,
      MESSAGE_TYPES.DICTIONARY_CHANGED,
    );
    if (changed) {
      emitDictionaryChanged({ langCode: changed.langCode ?? '', reason: changed.reason });
    }
    return false;
  };
  onMessage(listener);
  return () => removeOnMessageListener(listener);
}
