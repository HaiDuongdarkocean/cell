import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { BilingualCue } from '@/entities/media';
import { Button, Icon, Input } from '@/shared/ui';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import { createClozeExercise, type SubtitlePracticeMode } from '../lib/subtitlePractice';
import {
  ClozeActiveCue,
  ClozePromptCue,
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

export function SubtitlePracticeSession({
  mode,
  cues,
  currentTimeMs,
  offsetMs = 0,
  translationEnabled,
  onSeek,
  onPrevious,
  onReplay,
  onContinue,
  onPlayPause,
}: SubtitlePracticeSessionProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const [clozeDraft, setClozeDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const effectiveMs = currentTimeMs + offsetMs;
  const activeIndex = cues.findIndex((c) => c.start <= effectiveMs && c.end > effectiveMs);
  const activeCue = activeIndex >= 0 ? cues[activeIndex] : null;

  const resetKey = activeCue
    ? `${mode}:${activeCue.index}:${activeCue.start}:${activeCue.targetText}`
    : `${mode}:none`;
  const lastKeyRef = useRef(resetKey);

  const exercise = useMemo(
    () => (mode === 'cloze' && activeCue ? createClozeExercise(activeCue) : null),
    [mode, activeCue],
  );

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

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (!activeCue) return;
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onPrevious(activeCue);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      onContinue(activeCue);
      return;
    }
    if (e.key === ' ' && e.shiftKey) {
      e.preventDefault();
      onPlayPause();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      onReplay(activeCue);
    }
  };

  const renderCueContent = (
    cue: BilingualCue,
    index: number,
    isCurrent: boolean,
  ): React.ReactNode => {
    if (isCurrent) {
      return mode === 'dictation' ? (
        <DictationActiveCue cue={cue} draft={draft} translationEnabled={translationEnabled} />
      ) : (
        <ClozeActiveCue cue={cue} clozeDraft={clozeDraft} translationEnabled={translationEnabled} />
      );
    }
    if (mode === 'cloze' && (index === activeIndex - 1 || index === activeIndex + 1)) {
      return (
        <ClozePromptCue
          cue={cue}
          nativeText={index === activeIndex - 1 && translationEnabled ? cue.nativeText : undefined}
        />
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
        currentTimeMs={currentTimeMs}
        offsetMs={offsetMs}
        onSeek={onSeek}
        renderCueContent={renderCueContent}
        showNative={false}
      />
      <div className={styles.footer} data-cell-id="practice-footer">
        <div className={styles.shortcuts} data-cell-id="practice-shortcuts">
          <span>Ctrl/⌘+R Replay</span>
          <span>Enter Next</span>
          <span>Shift+Enter Previous</span>
          <span>Shift+Space Play/Pause</span>
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
