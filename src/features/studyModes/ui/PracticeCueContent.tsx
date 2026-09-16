import { useMemo } from 'react';
import type { BilingualCue } from '@/entities/media';
import { Text, VisuallyHidden } from '@/shared/ui';
import {
  buildClozeProgress,
  buildDictationProgress,
  createClozeExercise,
  evaluateDictation,
  normalizePracticeToken,
  type PracticeResult,
  type PracticeTokenState,
  type WordProgress,
} from '../lib/subtitlePractice';
import styles from './SubtitlePractice.module.css';

export function MaskedCueContent(): React.JSX.Element {
  return <div className={styles.maskedTarget} data-cell-id="cue-masked-target" aria-hidden="true" />;
}

interface PracticeWordProps {
  readonly word: WordProgress;
  readonly cellId: string;
  readonly charCellId?: string;
  readonly wordIndex?: number;
  readonly blankId?: string;
  readonly className?: string;
  readonly showCurrent?: boolean;
}

const wordDataState = (word: WordProgress): PracticeTokenState | '' => {
  if (word.state === 'pending') return '';
  if (word.typed.length === 0) return word.state === 'completed' ? 'missing' : '';
  return normalizePracticeToken(word.typed) === normalizePracticeToken(word.text) ? 'correct' : 'incorrect';
};

export function PracticeWord({
  word,
  cellId,
  charCellId,
  wordIndex,
  blankId,
  className = '',
  showCurrent = true,
}: PracticeWordProps): React.JSX.Element {
  const isHidden = word.visibleChars === null;
  const tailText = isHidden ? word.text : word.text.slice(word.visibleChars?.length ?? 0);
  const hasTail = tailText.length > 0;
  const baseClass = `${styles.word} ${className} ${showCurrent && word.state === 'active' ? styles.wordCurrent : ''}`.trim();
  return (
    <span
      className={baseClass}
      data-cell-id={cellId}
      data-word-state={word.state}
      data-state={wordDataState(word)}
      data-current={word.state === 'active' ? 'true' : 'false'}
      data-word-index={wordIndex}
      data-blank-id={blankId}
    >
      {isHidden ? (
        <span className={styles.guide} data-guide data-expected={word.text} aria-hidden="true" />
      ) : (
        <>
          {word.visibleChars?.map((char, j) => (
            <span key={j} className={styles[`token-${char.state}`]} data-cell-id={charCellId} data-state={char.state}>
              {char.char}
            </span>
          ))}
          {hasTail && (
            <span className={styles.guide} data-guide data-tail data-expected={tailText} aria-hidden="true" />
          )}
        </>
      )}
    </span>
  );
}

export function DictationActiveCue({
  cue,
  draft,
  result: providedResult,
  showTranslation,
  dataCellId = 'practice-active-cue',
}: {
  readonly cue: BilingualCue;
  readonly draft: string;
  readonly result?: PracticeResult | null;
  readonly showTranslation: boolean;
  readonly dataCellId?: string;
}): React.JSX.Element {
  const progress = useMemo(() => buildDictationProgress(cue.targetText, draft), [cue.targetText, draft]);
  const result = useMemo(
    () => providedResult ?? (draft.trim().length === 0 ? null : evaluateDictation(cue.targetText, draft)),
    [providedResult, cue.targetText, draft],
  );
  const showCurrent = dataCellId === 'practice-active-cue';
  return (
    <div className={styles.activeCue} data-cell-id={dataCellId} data-allow-lookup>
      <div className={styles.guides} aria-label="Type what you hear" data-cell-id="practice-active-cue-content">
        {progress.words.map((word, i) => (
          <PracticeWord
            key={i}
            word={word}
            cellId="dictation-word"
            charCellId="dictation-char"
            wordIndex={i}
            showCurrent={showCurrent}
          />
        ))}
      </div>
      {result ? (
        <div className={styles.feedback} data-cell-id="practice-feedback" role="status" aria-live="polite">
          <VisuallyHidden as="div">
            {`${result.correctCount} of ${result.totalCount} correct, ${result.score} percent`}
          </VisuallyHidden>
        </div>
      ) : null}
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
  const progress = useMemo(() => buildClozeProgress(exercise, clozeDraft), [exercise, clozeDraft]);
  if (exercise.blanks.length === 0) {
    return (
      <div className={styles.activeCue} data-cell-id={dataCellId}>
        <Text variant="supporting" color="secondary">No fillable words in this cue</Text>
      </div>
    );
  }
  const showCurrent = dataCellId === 'practice-active-cue';
  const blankById = new Map(exercise.blanks.map((b, i) => [b.id, i]));
  return (
    <div className={styles.activeCue} data-cell-id={dataCellId} data-allow-lookup>
      <div className={styles.clozeText}>
        {exercise.parts.map((part, i) => {
          if (part.type === 'text') {
            return <span key={i}>{part.text}</span>;
          }
          const blankIndex = blankById.get(part.id) ?? 0;
          const word = progress.words[blankIndex];
          if (!word) return null;
          return (
            <PracticeWord
              key={part.id}
              word={word}
              cellId="cloze-blank"
              charCellId="cloze-char"
              blankId={part.id}
              className={styles.blank}
              showCurrent={showCurrent}
            />
          );
        })}
      </div>
      {clozeDraft.trim().length > 0 && (
        <div className={styles.feedback} data-cell-id="practice-feedback" role="status" aria-live="polite">
          <VisuallyHidden as="div">
            {`${progress.correctCount} of ${exercise.blanks.length} correct${progress.extraCount > 0 ? `, ${progress.extraCount} extra` : ''}`}
          </VisuallyHidden>
        </div>
      )}
      {showTranslation && cue.nativeText ? (
        <div className={styles.nativeText} data-cell-id="cue-native-text">{cue.nativeText}</div>
      ) : null}
    </div>
  );
}


