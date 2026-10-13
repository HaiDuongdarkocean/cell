import { useMemo } from 'react';
import type { BilingualCue } from '@/entities/media';
import { Text, VisuallyHidden } from '@/shared/ui';
import { t } from '@/shared/i18n';
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
  return <div className={styles.maskedTarget} data-tihoka-id="cue-masked-target" aria-hidden="true" />;
}

interface PracticeWordProps {
  readonly word: WordProgress;
  readonly TihokaId: string;
  readonly charTihokaId?: string;
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
  TihokaId,
  charTihokaId,
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
      data-tihoka-id={TihokaId}
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
            <span key={j} className={styles[`token-${char.state}`]} data-tihoka-id={charTihokaId} data-state={char.state}>
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
  dataTihokaId = 'practice-active-cue',
}: {
  readonly cue: BilingualCue;
  readonly draft: string;
  readonly result?: PracticeResult | null;
  readonly showTranslation: boolean;
  readonly dataTihokaId?: string;
}): React.JSX.Element {
  const progress = useMemo(() => buildDictationProgress(cue.targetText, draft), [cue.targetText, draft]);
  const result = useMemo(
    () => providedResult ?? (draft.trim().length === 0 ? null : evaluateDictation(cue.targetText, draft)),
    [providedResult, cue.targetText, draft],
  );
  const showCurrent = dataTihokaId === 'practice-active-cue';
  return (
    <div className={styles.activeCue} data-tihoka-id={dataTihokaId} data-allow-lookup>
      <div className={styles.guides} aria-label={t('studyModes.practice.typeWhatYouHear')} data-tihoka-id="practice-active-cue-content">
        {progress.words.map((word, i) => (
          <PracticeWord
            key={i}
            word={word}
            TihokaId="dictation-word"
            charTihokaId="dictation-char"
            wordIndex={i}
            showCurrent={showCurrent}
          />
        ))}
      </div>
      {result ? (
        <div className={styles.feedback} data-tihoka-id="practice-feedback" role="status" aria-live="polite">
          <VisuallyHidden as="div">
            {t('studyModes.practice.result', [result.correctCount, result.totalCount, result.score])}
          </VisuallyHidden>
        </div>
      ) : null}
      {showTranslation && cue.nativeText ? (
        <div className={styles.nativeText} data-tihoka-id="cue-native-text">{cue.nativeText}</div>
      ) : null}
    </div>
  );
}

export function ClozeActiveCue({
  cue,
  clozeDraft,
  showTranslation,
  dataTihokaId = 'practice-active-cue',
}: {
  readonly cue: BilingualCue;
  readonly clozeDraft: string;
  readonly showTranslation: boolean;
  readonly dataTihokaId?: string;
}): React.JSX.Element {
  const exercise = useMemo(() => createClozeExercise(cue), [cue]);
  const progress = useMemo(() => buildClozeProgress(exercise, clozeDraft), [exercise, clozeDraft]);
  if (exercise.blanks.length === 0) {
    return (
      <div className={styles.activeCue} data-tihoka-id={dataTihokaId}>
        <Text variant="supporting" color="secondary">{t('studyModes.practice.noBlanks')}</Text>
      </div>
    );
  }
  const showCurrent = dataTihokaId === 'practice-active-cue';
  const blankById = new Map(exercise.blanks.map((b, i) => [b.id, i]));
  return (
    <div className={styles.activeCue} data-tihoka-id={dataTihokaId} data-allow-lookup>
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
              TihokaId="cloze-blank"
              charTihokaId="cloze-char"
              blankId={part.id}
              className={styles.blank}
              showCurrent={showCurrent}
            />
          );
        })}
      </div>
      {clozeDraft.trim().length > 0 && (
        <div className={styles.feedback} data-tihoka-id="practice-feedback" role="status" aria-live="polite">
          <VisuallyHidden as="div">
            {t('studyModes.practice.progress', [progress.correctCount, exercise.blanks.length]) +
              (progress.extraCount > 0 ? t('studyModes.practice.progressExtra', [progress.extraCount]) : '')}
          </VisuallyHidden>
        </div>
      )}
      {showTranslation && cue.nativeText ? (
        <div className={styles.nativeText} data-tihoka-id="cue-native-text">{cue.nativeText}</div>
      ) : null}
    </div>
  );
}


