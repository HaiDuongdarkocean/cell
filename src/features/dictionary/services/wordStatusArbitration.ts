import type { WordStatus } from '@/entities/dictionary';

export type WordStatusSource = 'user' | 'anki' | 'srs' | 'import';

const SOURCE_PRIORITY: Record<WordStatusSource, number> = {
  user: 3,
  anki: 2,
  srs: 1,
  import: 0,
};

export interface StatusWriteCandidate {
  readonly status: WordStatus;
  readonly source: WordStatusSource;
  readonly sourceAt: number;
}

export interface StatusWriteExisting {
  readonly status: WordStatus;
  readonly updatedAt: number;
  readonly source?: WordStatusSource;
  readonly sourceAt?: number;
}

export type StatusWriteDecision = 'write' | 'skip';

/** Last-write-wins arbitration for wordStatus writes.
 *  - Compares candidate event time (`sourceAt`) against the stored event time
 *    (`sourceAt ?? updatedAt`) so repeated sync writes from the same source
 *    still see each other's real event timestamps (local write time would
 *    otherwise always beat the older origin timestamp).
 *  - Equal timestamps → higher source priority wins (user > anki > srs > import).
 *    Sourceless legacy entries are treated as 'user' (user truth).
 *  - Non-user candidates never downgrade a stored 'known'.
 *  - Non-user `tracking` candidates never write onto a stored 'known' or
 *    'ignore' — card-side writes only lift the unknown family. */
export function decideStatusWrite(
  existing: StatusWriteExisting | undefined,
  candidate: StatusWriteCandidate,
): StatusWriteDecision {
  if (candidate.status === 'unknown' && !existing) return 'skip';
  if (!existing) return 'write';
  if (candidate.status === existing.status) return 'skip';
  if (
    candidate.source !== 'user' &&
    existing.status === 'known' &&
    candidate.status !== 'known'
  ) {
    return 'skip';
  }
  if (
    candidate.source !== 'user' &&
    candidate.status === 'tracking' &&
    (existing.status === 'known' || existing.status === 'ignore')
  ) {
    return 'skip';
  }
  const existingAt = existing.sourceAt ?? existing.updatedAt;
  if (candidate.sourceAt > existingAt) return 'write';
  if (candidate.sourceAt < existingAt) return 'skip';
  const existingPriority = SOURCE_PRIORITY[existing.source ?? 'user'];
  return SOURCE_PRIORITY[candidate.source] > existingPriority ? 'write' : 'skip';
}
