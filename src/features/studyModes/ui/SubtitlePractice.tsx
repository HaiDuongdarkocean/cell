import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { BilingualCue } from '@/entities/media';
import { Button, Icon, Input, Kbd } from '@/shared/ui';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import { createClozeExercise, evaluateDictation, evaluateCloze, tokenizePracticeText, type SubtitlePracticeMode } from '../lib/subtitlePractice';
import type { PracticeResult } from '../lib/subtitlePractice';
import {
  ClozeActiveCue,
  DictationActiveCue,
  MaskedCueContent,
} from './PracticeCueContent';
import styles from './SubtitlePractice.module.css';

export { PracticeOptions } from './PracticeOptions';
export type { PracticeOptionsProps } from './PracticeOptions';

const DICTATION_MAX_LENGTH = 2000;
const CLOZE_MAX_LENGTH = 600;

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
}: SubtitlePracticeSessionProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const [clozeDraft, setClozeDraft] = useState('');
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState<Map<string, { draft: string; result: PracticeResult | null }>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

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
  const lastKeyRef = useRef(resetKey);
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
      setVisited((prev) => new Set(prev).add(prevKey));
      setAttempts((prev) => new Map(prev).set(prevKey, { draft: attemptDraft, result }));
    }

    lastActiveCueRef.current = activeCue;
    lastModeRef.current = mode;
  }, [resetKey, activeCue, mode, draft, clozeDraft]);

  useEffect(() => {
    if (lastKeyRef.current === resetKey) return;
    lastKeyRef.current = resetKey;
    setDraft('');
    setClozeDraft('');
  }, [resetKey]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [resetKey]);

  const clozeUnavailable = mode === 'cloze' && activeCue !== null && (exercise?.blanks.length ?? 0) === 0;
  const inputDisabled = activeCue === null || clozeUnavailable;
  const blankCount = exercise?.blanks.length ?? 0;

  const inputValue = mode === 'dictation' ? draft : clozeDraft;

  const handleInputChange = (value: string): void => {
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
    if (e.key === 'Escape') return;

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
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
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
    if (visited.has(key)) {
      const attempt = attempts.get(key) ?? { draft: '', result: null };
      return mode === 'dictation' ? (
        <DictationActiveCue cue={cue} draft={attempt.draft} result={attempt.result} showTranslation={translationEnabled} dataCellId="practice-history-cue" />
      ) : (
        <ClozeActiveCue cue={cue} clozeDraft={attempt.draft} showTranslation={translationEnabled} dataCellId="practice-history-cue" />
      );
    }
    return <MaskedCueContent />;
  };

  const inputLabel = mode === 'dictation'
    ? 'Type what you hear'
    : `Type ${blankCount} missing word${blankCount === 1 ? '' : 's'}`;

  return (
    <div className={styles.session} data-cell-id="subtitle-practice" data-practice-mode={mode}>
      <CueList
        cues={cues}
        currentTimeMs={activeCue ? activeCue.start - offsetMs : currentTimeMs}
        offsetMs={offsetMs}
        onSeek={onSeek}
        renderCueContent={renderCueContent}
        showNative={false}
      />
      <div className={styles.footer} data-cell-id="practice-footer">
        <div className={styles.shortcuts} data-cell-id="practice-shortcuts">
          <span><Kbd>Ctrl/⌘+R</Kbd> Phát lại</span>
          <span><Kbd>Enter</Kbd> Câu tiếp</span>
          <span><Kbd>Shift+Enter</Kbd> Câu trước</span>
          <span><Kbd>Shift+Space</Kbd> Tạm dừng</span>
        </div>
        <div className={styles.inputRow}>
          <Button
            size="sm"
            variant="secondary"
            ripple={false}
            className={styles.navButton}
            data-cell-id="practice-previous"
            aria-label="Previous cue"
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
            data-cell-id="practice-replay"
            aria-label="Replay cue"
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
              data-cell-id="practice-input"
              aria-label={inputLabel}
              placeholder={mode === 'dictation' ? 'Type what you hear…' : inputLabel}
              maxLength={mode === 'dictation' ? DICTATION_MAX_LENGTH : CLOZE_MAX_LENGTH}
              disabled={inputDisabled}
              value={inputValue}
              onChange={(e) => handleInputChange(e.currentTarget.value)}
              onKeyDown={handleInputKeyDown}
              onKeyUp={handleInputKeyUp}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            ripple={false}
            className={styles.navButton}
            data-cell-id="practice-next"
            aria-label="Next cue"
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
