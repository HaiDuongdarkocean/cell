import type { ChangeRecord } from '../types';
import type { ProfileRecords } from './policies';
import {
  isDeadPut,
  mergeLww,
  mergeProfileConfig,
  mergeReaderProgress,
  mergeSrsCard,
  mergeSrsReviewEvent,
} from './policies';

export interface MergeContext {
  readonly profile?: ProfileRecords;
  readonly keyTombstone?: ChangeRecord | null;
}

export function mergeRecord(
  local: ChangeRecord | null,
  remote: ChangeRecord,
  ctx: MergeContext = {},
): ChangeRecord | null {
  const tombstone = ctx.keyTombstone ?? null;
  const aliveLocal =
    local !== null && !isDeadPut(local, tombstone) ? local : null;
  if (isDeadPut(remote, tombstone)) return aliveLocal;
  const aliveRemote = remote;
  switch (aliveRemote.dataClass) {
    case 'profileConfig':
      return mergeProfileConfig(aliveLocal, aliveRemote, ctx.profile);
    case 'srsCard':
      return mergeSrsCard(aliveLocal, aliveRemote);
    case 'srsReviewEvent':
      return mergeSrsReviewEvent(aliveLocal, aliveRemote);
    case 'readerProgress':
      return mergeReaderProgress(aliveLocal, aliveRemote);
    default:
      return mergeLww(aliveLocal, aliveRemote);
  }
}
