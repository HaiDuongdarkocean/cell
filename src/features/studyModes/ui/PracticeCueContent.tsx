import { useMemo } from 'react';
import type { BilingualCue } from '@/entities/media';
import { Text, VisuallyHidden } from '@/shared/ui';
import {
  createClozeExercise,
  evaluateDictation,
  normalizePracticeToken,
  tokenizePracticeText,
  type PracticeResult,
  type PracticeTokenState,
} from '../lib/subtitlePractice';
import styles from './SubtitlePractice.module.css';

function FeedbackTokens({ result }: { readonly result: PracticeResult }): React.JSX.Element {
  return (
    <div className={styles.feedbackTokens} aria-hidden="true">
      {result.feedback.map((f, i) => (
        <span key={i} className={styles[`token-${f.state}`]} data-state={f.state}>
          {f.text}
        </span>
      ))}
    </div>
  );
}

export function MaskedCueContent(): React.JSX.Element {
  return <div className={styles.maskedTarget} data-cell-id="cue-masked-target" aria-hidden="true" />;
}

export function DictationActiveCue({
  cue,
  draft,
  showTranslation,
  dataCellId = 'practice-active-cue',
}: {
  readonly cue: BilingualCue;
  readonly draft: string;
  readonly showTranslation: boolean;
  readonly dataCellId?: string;
}): React.JSX.Element {
  const expectedTokens = useMemo(() => tokenizePracticeText(cue.targetText), [cue.targetText]);
  const result = useMemo(
    () => (draft.trim().length === 0 ? null : evaluateDictation(cue.targetText, draft)),
    [cue.targetText, draft],
  );
  return (
    <div className={styles.activeCue} data-cell-id={dataCellId} data-allow-lookup>
      {result ? (
        <div className={styles.feedback} data-cell-id="practice-feedback" role="status" aria-live="polite">
          <VisuallyHidden as="div">
            {`${result.correctCount} of ${result.totalCount} correct, ${result.score} percent`}
          </VisuallyHidden>
          <FeedbackTokens result={result} />
        </div>
      ) : (
        <div className={styles.guides} aria-label="Type what you hear">
          {expectedTokens.map((_token, i) => (
            <span key={i} className={styles.guide} data-guide aria-hidden="true" />
          ))}
        </div>
      )}
      {showTranslation && cue.nativeText ? (
        <div className={styles.nativeText} data-cell-id="cue-native-text">{cue.nativeText}</div>
      ) : null}
    </div>
  );
}

export function ClozeActiveCue({
  cue,
  clozeDraft,
  showTranslation,
  dataCellId = 'practice-active-cue',
}: {
  readonly cue: BilingualCue;
  readonly clozeDraft: string;
  readonly showTranslation: boolean;
  readonly dataCellId?: string;
}): React.JSX.Element {
  const exercise = useMemo(() => createClozeExercise(cue), [cue]);
  const typedTokens = useMemo(() => tokenizePracticeText(clozeDraft), [clozeDraft]);
  if (exercise.blanks.length === 0) {
    return (
      <div className={styles.activeCue} data-cell-id={dataCellId}>
        <Text variant="supporting" color="secondary">No fillable words in this cue</Text>
      </div>
    );
  }
  const blankById = new Map(exercise.blanks.map((b, i) => [b.id, i]));
  const correctCount = exercise.blanks.reduce(
    (count, blank, i) =>
      count + (typedTokens[i] !== undefined && normalizePracticeToken(typedTokens[i]) === normalizePracticeToken(blank.answer) ? 1 : 0),
    0,
  );
  const extraCount = Math.max(0, typedTokens.length - exercise.blanks.length);
  const currentIndex = Math.min(typedTokens.length, exercise.blanks.length - 1);
  return (
    <div className={styles.activeCue} data-cell-id={dataCellId} data-allow-lookup>
      <div className={styles.clozeText}>
        {exercise.parts.map((part, i) => {
          if (part.type === 'text') {
            return <span key={i}>{part.text}</span>;
          }
          const blankIndex = blankById.get(part.id) ?? 0;
          const typed = typedTokens[blankIndex] ?? '';
          const isCurrent = blankIndex === currentIndex;
          const state: PracticeTokenState | '' = typed.length === 0
            ? ''
            : normalizePracticeToken(typed) === normalizePracticeToken(part.answer)
              ? 'correct'
              : 'incorrect';
          return (
            <span
              key={part.id}
              className={`${styles.blank} ${isCurrent ? styles.blankCurrent : ''} ${state ? styles[`token-${state}`] : ''}`}
              data-cell-id="cloze-blank"
              data-blank-id={part.id}
              data-current={isCurrent ? 'true' : 'false'}
              data-state={state}
            >
              {typed.length > 0 ? typed : <span className={styles.guide} data-guide aria-hidden="true" />}
            </span>
          );
        })}
      </div>
      {clozeDraft.trim().length > 0 && (
        <div className={styles.feedback} data-cell-id="practice-feedback" role="status" aria-live="polite">
          <VisuallyHidden as="div">
            {`${correctCount} of ${exercise.blanks.length} correct${extraCount > 0 ? `, ${extraCount} extra` : ''}`}
          </VisuallyHidden>
        </div>
      )}
      {showTranslation && cue.nativeText ? (
        <div className={styles.nativeText} data-cell-id="cue-native-text">{cue.nativeText}</div>
      ) : null}
    </div>
  );
}


