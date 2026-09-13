import type { PlaybackSpeed } from '@/entities/studyMode/types';
import { Button, Select, Toggle } from '@/shared/ui';
import type { SubtitlePracticeMode } from '../lib/subtitlePractice';
import styles from './SubtitlePractice.module.css';

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
];

const MODE_LABEL: Record<SubtitlePracticeMode, string> = {
  off: 'Off',
  dictation: 'Dictation',
  cloze: 'Cloze',
};

export interface PracticeOptionsProps {
  readonly mode: SubtitlePracticeMode;
  readonly translationEnabled: boolean;
  readonly playbackSpeed: PlaybackSpeed;
  readonly onModeChange: (mode: SubtitlePracticeMode) => void;
  readonly onTranslationChange: (enabled: boolean) => void;
  readonly onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
}

export function PracticeOptions({
  mode,
  translationEnabled,
  playbackSpeed,
  onModeChange,
  onTranslationChange,
  onPlaybackSpeedChange,
}: PracticeOptionsProps): React.JSX.Element {
  return (
    <div className={styles.options} data-cell-id="practice-options">
      <div className={styles.modeRow}>
        <span className={styles.optionsTitle}>Practice</span>
        <div className={styles.segmented} role="radiogroup" aria-label="Practice mode">
          {(['off', 'dictation', 'cloze'] as const).map((candidate) => (
            <Button
              key={candidate}
              size="sm"
              ripple={false}
              variant={mode === candidate ? 'primary' : 'ghost'}
              role="radio"
              aria-checked={mode === candidate}
              data-cell-id={`practice-mode-${candidate}`}
              onClick={() => onModeChange(candidate)}
            >
              {MODE_LABEL[candidate]}
            </Button>
          ))}
        </div>
      </div>
      <div className={styles.optionsRow}>
        <span className={styles.optionField}>
          <span className={styles.optionLabel}>Auto-translate</span>
          <Toggle
            size="md"
            id="practice-translation"
            dataTestId="practice-translation"
            ariaLabel="Auto-translate"
            checked={translationEnabled}
            onChange={onTranslationChange}
          />
        </span>
        <span className={styles.optionField}>
          <span className={styles.optionLabel}>Speed</span>
          <Select
            id="practice-speed"
            data-cell-id="practice-speed"
            aria-label="Playback speed"
            size="sm"
            value={String(playbackSpeed)}
            options={SPEED_OPTIONS}
            onChange={(value) => onPlaybackSpeedChange(Number(value) as PlaybackSpeed)}
          />
        </span>
      </div>
    </div>
  );
}
