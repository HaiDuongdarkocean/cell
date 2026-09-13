import { useMemo } from 'react';
import type { BilingualCue } from '@/entities/media';
import { Text } from '@/shared/ui';
import {
  createClozeExercise,
  evaluateDictation,
  normalizePracticeToken,
  tokenizePracticeText,
  type PracticeResult,
  type PracticeTokenState,
} from '../lib/subtitlePractice';
import styles from './SubtitlePractice.module.css';

const TOKEN_STATE_LABEL: Record<PracticeTokenState, string> = {
  correct: 'correct',
  incorrect: 'incorrect',
  missing: 'missing',
  extra: 'extra',
};

function FeedbackTokens({ result }: { readonly result: PracticeResult }): React.JSX.Element {
  return (
    <div className={styles.feedbackTokens}>
      {result.feedback.map((f, i) => (
        <span key={i} className={styles[`token-${f.state}`]} data-state={f.state}>
          {f.text}
          {f.state !== 'correct' && (
            <span className={styles.tokenNote}>
              {` (${TOKEN_STATE_LABEL[f.state]}${f.expected !== undefined && f.expected !== f.text ? `: ${f.expected}` : ''})`}
            </span>
          )}
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
  translationEnabled,
}: {
  readonly cue: BilingualCue;
  readonly draft: string;
  readonly translationEnabled: boolean;
}): React.JSX.Element {
  const expectedTokens = useMemo(() => tokenizePracticeText(cue.targetText), [cue.targetText]);
  const result = useMemo(
    () => (draft.trim().length === 0 ? null : evaluateDictation(cue.targetText, draft)),
    [cue.targetText, draft],
  );
  return (
    <div className={styles.activeCue} data-cell-id="practice-active-cue" data-allow-lookup>
      {result ? (
        <div
          className={styles.feedback}
          data-cell-id="practice-feedback"
          role="status"
          aria-live="polite"
        >
          <Text variant="supporting" color="secondary">
            {`${result.correctCount}/${result.totalCount} correct — ${result.score}%`}
          </Text>
          <FeedbackTokens result={result} />
        </div>
      ) : (
        <div className={styles.guides} aria-label="Type what you hear">
          {expectedTokens.map((_token, i) => (
            <span key={i} className={styles.guide} data-guide aria-hidden="true" />
          ))}
        </div>
      )}
      {translationEnabled && cue.nativeText ? (
        <div className={styles.nativeText} data-cell-id="cue-native-text">{cue.nativeText}</div>
      ) : null}
    </div>
  );
}

export function ClozeActiveCue({
  cue,
  clozeDraft,
  translationEnabled,
}: {
  readonly cue: BilingualCue;
  readonly clozeDraft: string;
  readonly translationEnabled: boolean;
}): React.JSX.Element {
  const exercise = useMemo(() => createClozeExercise(cue), [cue]);
  const typedTokens = useMemo(() => tokenizePracticeText(clozeDraft), [clozeDraft]);
  if (exercise.blanks.length === 0) {
    return (
      <div className={styles.activeCue} data-cell-id="practice-active-cue">
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
    <div className={styles.activeCue} data-cell-id="practice-active-cue" data-allow-lookup>
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
        <div
          className={styles.feedback}
          data-cell-id="practice-feedback"
          role="status"
          aria-live="polite"
        >
          <Text variant="supporting" color="secondary">
            {`${correctCount} of ${exercise.blanks.length} correct${extraCount > 0 ? `, ${extraCount} extra` : ''}`}
          </Text>
        </div>
      )}
      {translationEnabled && cue.nativeText ? (
        <div className={styles.nativeText} data-cell-id="cue-native-text">{cue.nativeText}</div>
      ) : null}
    </div>
  );
}

export function ClozePromptCue({
  cue,
  nativeText,
}: {
  readonly cue: BilingualCue;
  readonly nativeText?: string;
}): React.JSX.Element {
  const exercise = useMemo(() => createClozeExercise(cue), [cue]);
  return (
    <div className={styles.promptCue} data-cell-id="cloze-prompt">
      <div className={styles.clozeText}>
        {exercise.parts.map((part, i) =>
          part.type === 'text' ? (
            <span key={i}>{part.text}</span>
          ) : (
            <span key={part.id} className={styles.blank}>
              <span className={styles.guide} data-guide aria-hidden="true" />
            </span>
          ),
        )}
      </div>
      {nativeText ? (
        <div className={`${styles.nativeText} ${styles.adjacentNative}`} data-cell-id="cue-native-text">
          {nativeText}
        </div>
      ) : null}
    </div>
  );
}
