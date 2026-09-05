import { type ReactElement } from 'react';
import { Text, Button, Chip, HStack, VStack, Icon } from '@/shared/ui';
import type { StudyStep } from '@/entities/studyMode';
import styles from './StepEditor.module.css';

const SUBTITLE_OPTIONS: StudyStep['subtitle'][] = ['none', 'native', 'target', 'both'];
const PAUSE_OPTIONS: StudyStep['pause'][] = ['none', 'start', 'end'];
const REPEAT_OPTIONS: StudyStep['repeat'][] = [1, 2, 3];
const SPEED_OPTIONS: StudyStep['speed'][] = [0.5, 0.75, 1, 1.25, 1.5];
const AFTER_OPTIONS: StudyStep['after'][] = ['continue', 'wait', 'loop'];

interface StepEditorProps {
  readonly index: number;
  readonly step: StudyStep;
  readonly onChange: (step: StudyStep) => void;
  readonly onRemove?: () => void;
}

export function StepEditor({ index, step, onChange, onRemove }: StepEditorProps): ReactElement {
  const OptionGroup = <K extends keyof StudyStep>(
    label: string,
    options: readonly StudyStep[K][],
    current: StudyStep[K],
    field: K,
  ): ReactElement => (
    <div className={styles.stepOption} role="group" aria-label={label}>
      <Text as="span" variant="label" color="secondary" className={styles.stepOptionLabel}>
        {label}
      </Text>
      <HStack gap="1" className={styles.stepChipGroup}>
        {options.map((option) => (
          <Chip
            key={String(option)}
            as="button"
            size="sm"
            selected={current === option}
            onClick={() => onChange({ ...step, [field]: option })}
            data-cell-id={`step-${index}-${field}-${option}`}
          >
            {String(option)}
          </Chip>
        ))}
      </HStack>
    </div>
  );

  return (
    <div className={styles.stepRow} data-cell-id={`step-row-${index}`}>
      <Text as="span" variant="label" className={styles.stepIndex}>
        {index + 1}
      </Text>
      <VStack gap="2" className={styles.stepOptions}>
        {OptionGroup('Subtitle', SUBTITLE_OPTIONS, step.subtitle, 'subtitle')}
        {OptionGroup('Pause', PAUSE_OPTIONS, step.pause, 'pause')}
        {OptionGroup('Repeat', REPEAT_OPTIONS, step.repeat, 'repeat')}
        {OptionGroup('Speed', SPEED_OPTIONS, step.speed, 'speed')}
        {OptionGroup('After', AFTER_OPTIONS, step.after, 'after')}
      </VStack>
      {onRemove && (
        <Button
          size="xs"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Remove step ${index + 1}`}
          data-cell-id={`remove-step-${index}`}
          leadingIcon={<Icon name="trash" size="xs" />}
        />
      )}
    </div>
  );
}
