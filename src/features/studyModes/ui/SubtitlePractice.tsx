import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { BilingualCue } from '@/entities/media';
import { Button, Icon, Input, Kbd } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { createClozeExercise, evaluateDictation, evaluateCloze, tokenizePracticeText, type SubtitlePracticeMode } from '../lib/subtitlePractice';
import type { PracticeResult } from '../lib/subtitlePractice';
import {
  ClozeActiveCue,
  DictationActiveCue,
} from './PracticeCueContent';
import styles from './SubtitlePractice.module.css';

export { PracticeOptions } from './PracticeOptions';
export type { PracticeOptionsProps } from './PracticeOptions';

const DICTATION_MAX_LENGTH = 2000;
const CLOZE_MAX_LENGTH = 600;

/** Cue-list contract the practice session renders through. The concrete
 *  implementation (subtitle feature's CueList) is injected by the caller so
 *  studyModes never imports from subtitle. */
export interface PracticeCueListProps {
  readonly cues: BilingualCue[];
  readonly currentTimeMs: number;
  readonly offsetMs?: number;
  readonly onSeek: (timeMs: number) => void;
  readonly renderCueContent?: (cue: BilingualCue, index: number, isCurrent: boolean) => ReactNode | undefined;
  readonly showNative?: boolean;
}

export interface SubtitlePracticeSessionProps {
  readonly mode: Exclude<SubtitlePracticeMode, 'off'>;
  readonly cues: BilingualCue[];
  readonly currentTimeMs: number;
  readonly offsetMs?: number;
  readonly translationEnabled: boolean;
  readonly isPlaying: boolean;
  readonly onSeek: (timeMs: number) => void;
  readonly onPrevious: (cue: BilingualCue) => void;
  readonly onReplay: (cue: BilingualCue) => void;
  readonly onContinue: (cue: BilingualCue) => void;
  readonly onPlayPause: () => void;
  readonly CueListComponent: ComponentType<PracticeCueListProps>;
}

function cueKey(cue: BilingualCue | null, mode: SubtitlePracticeMode): string {
  if (!cue) return `${mode}:none`;
  return `${mode}:${cue.index}:${cue.start}:${cue.targetText}`;
}

export function SubtitlePracticeSession({
  mode,
  cues,
  currentTimeMs,
  offsetMs = 0,
  translationEnabled,
  isPlaying,
  onSeek,
  onPrevious,
  onReplay,
  onContinue,
  onPlayPause,
  CueListComponent,
}: SubtitlePracticeSessionProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const [clozeDraft, setClozeDraft] = useState('');
  const [attempts, setAttempts] = useState<Map<string, { draft: string; result: PracticeResult | null }>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const hasTypedRef = useRef(false);
  const ctrlPendingRef = useRef(false);

  const effectiveMs = currentTimeMs + offsetMs;
  const activeIndex = useMemo(() => {
    const byTime = cues.findIndex((c) => c.start <= effectiveMs && c.end > effectiveMs);
    if (byTime >= 0) return byTime;
    if (!isPlaying) {
      for (let i = cues.length - 1; i >= 0; i -= 1) {
        if (cues[i].end <= effectiveMs) return i;
      }
    }
    return -1;
  }, [cues, effectiveMs, isPlaying]);
  const activeCue = activeIndex >= 0 ? cues[activeIndex] : null;

  const resetKey = cueKey(activeCue, mode);
  const lastResetKeyRef = useRef('');
  const lastActiveCueRef = useRef(activeCue);
  const lastModeRef = useRef(mode);

  const exercise = useMemo(
    () => (mode === 'cloze' && activeCue ? createClozeExercise(activeCue) : null),
    [mode, activeCue],
  );

  useEffect(() => {
    const prevCue = lastActiveCueRef.current;
    const prevMode = lastModeRef.current;
    const prevKey = cueKey(prevCue, prevMode);
    const nextKey = resetKey;

    if (prevKey !== nextKey && prevCue !== null) {
      const attemptDraft = prevMode === 'dictation' ? draft : clozeDraft;
      if (hasTypedRef.current && attemptDraft.trim().length > 0) {
        let result: PracticeResult | null = null;
        if (prevMode === 'dictation') {
          result = evaluateDictation(prevCue.targetText, attemptDraft);
        } else if (prevMode === 'cloze') {
          const exercise = createClozeExercise(prevCue);
          const answers = Object.fromEntries(
            exercise.blanks.map((blank, i) => {
              const typed = tokenizePracticeText(attemptDraft)[i] ?? '';
              return [blank.id, typed];
            }),
          );
          result = evaluateCloze(exercise, answers);
        }
        setAttempts((prev) => new Map(prev).set(prevKey, { draft: attemptDraft, result }));
      }
      hasTypedRef.current = false;
    }

    lastActiveCueRef.current = activeCue;
    lastModeRef.current = mode;
  }, [resetKey, activeCue, mode, draft, clozeDraft]);

  useEffect(() => {
    if (activeCue === null) return;
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    setDraft('');
    setClozeDraft('');
    hasTypedRef.current = false;
    inputRef.current?.focus();
  }, [resetKey, activeCue]);

  const clozeUnavailable = mode === 'cloze' && activeCue !== null && (exercise?.blanks.length ?? 0) === 0;
  const inputDisabled = activeCue === null || clozeUnavailable;
  const blankCount = exercise?.blanks.length ?? 0;

  useEffect(() => {
    if (!inputDisabled) {
      inputRef.current?.focus();
    }
  }, [inputDisabled]);

  const inputValue = mode === 'dictation' ? draft : clozeDraft;

  const handleInputChange = (value: string): void => {
    hasTypedRef.current = true;
    if (mode === 'dictation') {
      setDraft(value);
    } else {
      setClozeDraft(value);
    }
  };

  const stopKeyboardLeak = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  const handleInputKeyDown = useCallback((e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      ctrlPendingRef.current = false;
      return;
    }
    if (e.key === 'Control') {
      if (!e.repeat) ctrlPendingRef.current = true;
      stopKeyboardLeak(e);
      return;
    }
    if (ctrlPendingRef.current) ctrlPendingRef.current = false;

    if (activeCue) {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        onPrevious(activeCue);
        stopKeyboardLeak(e);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onContinue(activeCue);
        stopKeyboardLeak(e);
        return;
      }
      if (e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        onPlayPause();
        stopKeyboardLeak(e);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onReplay(activeCue);
        stopKeyboardLeak(e);
        return;
      }
    }

    stopKeyboardLeak(e);
  }, [activeCue, onContinue, onPlayPause, onPrevious, onReplay]);

  const handleInputKeyUp = useCallback((e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') return;
    if (e.key === 'Control' && ctrlPendingRef.current) {
      ctrlPendingRef.current = false;
      if (activeCue) onReplay(activeCue);
    }
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  }, [activeCue, onReplay]);

  const handleInputBlur = useCallback((): void => {
    ctrlPendingRef.current = false;
  }, []);

  const renderCueContent = (
    cue: BilingualCue,
    _index: number,
    isCurrent: boolean,
  ): React.ReactNode => {
    const key = cueKey(cue, mode);
    if (isCurrent) {
      return mode === 'dictation' ? (
        <DictationActiveCue cue={cue} draft={draft} showTranslation={false} />
      ) : (
        <ClozeActiveCue cue={cue} clozeDraft={clozeDraft} showTranslation={false} />
      );
    }
    if (attempts.has(key)) {
      const attempt = attempts.get(key) ?? { draft: '', result: null };
      return mode === 'dictation' ? (
        <DictationActiveCue cue={cue} draft={attempt.draft} result={attempt.result} showTranslation={translationEnabled} dataTihokaId="practice-history-cue" />
      ) : (
        <ClozeActiveCue cue={cue} clozeDraft={attempt.draft} showTranslation={translationEnabled} dataTihokaId="practice-history-cue" />
      );
    }
    return mode === 'dictation' ? (
      <DictationActiveCue cue={cue} draft="" showTranslation={translationEnabled} dataTihokaId="practice-preview-cue" />
    ) : (
      <ClozeActiveCue cue={cue} clozeDraft="" showTranslation={translationEnabled} dataTihokaId="practice-preview-cue" />
    );
  };

  const inputLabel = mode === 'dictation'
    ? t('studyModes.practice.typeWhatYouHear')
    : blankCount === 1
      ? t('studyModes.practice.typeMissingOne')
      : t('studyModes.practice.typeMissingMany', [blankCount]);

  return (
    <div className={styles.session} data-tihoka-id="subtitle-practice" data-practice-mode={mode}>
      <CueListComponent
        cues={cues}
        currentTimeMs={activeCue ? activeCue.start - offsetMs : currentTimeMs}
        offsetMs={offsetMs}
        onSeek={onSeek}
        renderCueContent={renderCueContent}
        showNative={false}
      />
      <div className={styles.footer} data-tihoka-id="practice-footer">
        <div className={styles.shortcuts} data-tihoka-id="practice-shortcuts">
          <span><Kbd>Ctrl</Kbd> {t('studyModes.practice.hintReplay')}</span>
          <span><Kbd>Enter</Kbd> {t('studyModes.practice.hintNext')}</span>
          <span><Kbd>Shift+Enter</Kbd> {t('studyModes.practice.hintPrev')}</span>
          <span><Kbd>Shift+Space</Kbd> {t('studyModes.practice.hintPause')}</span>
        </div>
        <div className={styles.inputRow}>
          <Button
            size="sm"
            variant="secondary"
            ripple={false}
            className={styles.navButton}
            data-tihoka-id="practice-previous"
            aria-label={t('studyModes.practice.prevCue')}
            disabled={!activeCue}
            onClick={() => activeCue && onPrevious(activeCue)}
          >
            <Icon name="chevronLeft" size="md" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            ripple={false}
            className={styles.navButton}
            data-tihoka-id="practice-replay"
            aria-label={t('studyModes.practice.replayCue')}
            disabled={!activeCue}
            onClick={() => activeCue && onReplay(activeCue)}
          >
            <Icon name="rotateCcw" size="md" />
          </Button>
          <div className={styles.answerInputWrap}>
            <Input
              ref={inputRef}
              size="sm"
              className={styles.answerInput}
              data-tihoka-id="practice-input"
              aria-label={inputLabel}
              placeholder={mode === 'dictation' ? t('studyModes.practice.typeWhatYouHear') : inputLabel}
              maxLength={mode === 'dictation' ? DICTATION_MAX_LENGTH : CLOZE_MAX_LENGTH}
              disabled={inputDisabled}
              value={inputValue}
              onChange={(e) => handleInputChange(e.currentTarget.value)}
              onKeyDown={handleInputKeyDown}
              onKeyUp={handleInputKeyUp}
              onBlur={handleInputBlur}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            ripple={false}
            className={styles.navButton}
            data-tihoka-id="practice-next"
            aria-label={t('studyModes.practice.nextCue')}
            disabled={!activeCue}
            onClick={() => activeCue && onContinue(activeCue)}
          >
            <Icon name="chevronRight" size="md" />
          </Button>
        </div>
      </div>
    </div>
  );
}
