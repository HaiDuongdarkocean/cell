import type { PlaybackSpeed } from '@/entities/studyMode/types';
import { Text, Chip, Select, HStack, VStack } from '@/shared/ui';
import { t, type MessageKey } from '@/shared/i18n';
import type { SubtitlePracticeMode } from '../lib/subtitlePractice';
import styles from './PracticeOptions.module.css';

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
];

const MODE_KEYS: Record<SubtitlePracticeMode, MessageKey> = {
  off: 'studyModes.practice.off',
  dictation: 'studyModes.practice.dictation',
  cloze: 'studyModes.practice.cloze',
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
      <HStack align="center" gap="2" className={styles.row} role="radiogroup" aria-label={t('studyModes.practice.optionsAria')}>
        <Text variant="label" color="secondary" className={styles.eyebrow} as="span">
          {t('studyModes.practice.title')}
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
              {t(MODE_KEYS[candidate])}
            </Chip>
          ))}
        </HStack>
      </HStack>
      <HStack align="center" gap="2" className={styles.row}>
        <Text variant="label" color="secondary" className={styles.eyebrow} as="span">
          {t('studyModes.step.speed')}
        </Text>
        <div className={styles.speedSelect}>
          <Select
            id="practice-speed"
            data-cell-id="practice-speed"
            aria-label={t('studyModes.speed.aria')}
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
