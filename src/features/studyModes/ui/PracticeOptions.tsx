import type { PlaybackSpeed } from '@/entities/studyMode/types';
import { Text, Chip, Select, HStack, VStack } from '@/shared/ui';
import type { SubtitlePracticeMode } from '../lib/subtitlePractice';
import styles from './PracticeOptions.module.css';

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
  readonly playbackSpeed: PlaybackSpeed;
  readonly onModeChange: (mode: SubtitlePracticeMode) => void;
  readonly onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
}

export function PracticeOptions({
  mode,
  playbackSpeed,
  onModeChange,
  onPlaybackSpeedChange,
}: PracticeOptionsProps): React.JSX.Element {
  return (
    <VStack className={styles.practiceOptions} data-cell-id="practice-options" gap="2">
      <HStack align="center" gap="2" className={styles.row} role="radiogroup" aria-label="Practice mode">
        <Text variant="label" color="secondary" className={styles.eyebrow} as="span">
          Practice
        </Text>
        <HStack align="center" gap="2" className={styles.chipRow}>
          {(['off', 'dictation', 'cloze'] as const).map((candidate) => (
            <Chip
              key={candidate}
              as="button"
              size="sm"
              selected={mode === candidate}
              ripple={false}
              data-cell-id={`practice-mode-${candidate}`}
              role="radio"
              aria-checked={mode === candidate}
              aria-pressed={undefined}
              type="button"
              onClick={() => onModeChange(candidate)}
            >
              {MODE_LABEL[candidate]}
            </Chip>
          ))}
        </HStack>
      </HStack>
      <HStack align="center" gap="2" className={styles.row}>
        <Text variant="label" color="secondary" className={styles.eyebrow} as="span">
          Speed
        </Text>
        <div className={styles.speedSelect}>
          <Select
            id="practice-speed"
            data-cell-id="practice-speed"
            aria-label="Playback speed"
            size="sm"
            value={String(playbackSpeed)}
            options={SPEED_OPTIONS}
            onChange={(value) => onPlaybackSpeedChange(Number(value) as PlaybackSpeed)}
          />
        </div>
      </HStack>
    </VStack>
  );
}
