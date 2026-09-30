import type { ReviewJudgment, SrsFsrsSerializedState, SrsReviewRecord } from '@/entities/srs/types';
import type { NormalizedAnkiRevlog } from '../model/normalized';

/**
 * Map one Anki revlog row to an `SrsReviewRecord`.
 * Deterministic id → re-import dedups at the repository level.
 * `resultingProgress`/`resultingFsrsState` carry the *imported* component
 * state — an approximation acceptable because stats only consume time +
 * judgment.
 */
export function mapRevlog(
  rev: NormalizedAnkiRevlog,
  cardId: string,
  noteId: string,
  notetypeId: string,
  resultingFsrsState: SrsFsrsSerializedState,
  resultingProgress: number,
): SrsReviewRecord {
  const judgment: ReviewJudgment = rev.ease === 1 ? 'forget' : 'remember';
  return {
    id: `import-anki-${rev.id}`,
    cardId,
    noteId,
    notetypeId,
    componentType: 'meaning',
    templateId: 'imported',
    stimulusType: 'definition',
    startedAt: rev.id - rev.time,
    answeredAt: rev.id,
    judgment,
    isStudyAgain: false,
    resultingProgress,
    resultingFsrsState,
  };
}
