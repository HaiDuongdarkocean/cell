import { type ReactElement } from 'react';
import { Text, Button, Chip, HStack, VStack, Icon } from '@/shared/ui';
import { t, type MessageKey } from '@/shared/i18n';
import type { StudyStep } from '@/entities/studyMode';
import styles from './StepEditor.module.css';

const SUBTITLE_OPTIONS: StudyStep['subtitle'][] = ['none', 'native', 'target', 'both', 'adaptive'];
const PAUSE_OPTIONS: StudyStep['pause'][] = ['none', 'start', 'end'];
const REPEAT_OPTIONS: StudyStep['repeat'][] = [1, 2, 3];
const SPEED_OPTIONS: StudyStep['speed'][] = [0.5, 0.75, 1, 1.25, 1.5];
const AFTER_OPTIONS: StudyStep['after'][] = ['continue', 'wait', 'loop'];
const SKIP_OPTIONS = ['never', 'non-i1'] as const;

const SUBTITLE_OPTION_KEYS: Record<StudyStep['subtitle'], MessageKey> = {
  none: 'studyModes.step.opt.subtitle.none',
  native: 'studyModes.step.opt.subtitle.native',
  target: 'studyModes.step.opt.subtitle.target',
  both: 'studyModes.step.opt.subtitle.both',
  adaptive: 'studyModes.step.opt.subtitle.adaptive',
};
const PAUSE_OPTION_KEYS: Record<StudyStep['pause'], MessageKey> = {
  none: 'studyModes.step.opt.pause.none',
  start: 'studyModes.step.opt.pause.start',
  end: 'studyModes.step.opt.pause.end',
};
const AFTER_OPTION_KEYS: Record<StudyStep['after'], MessageKey> = {
  continue: 'studyModes.step.opt.after.continue',
  wait: 'studyModes.step.opt.after.wait',
  loop: 'studyModes.step.opt.after.loop',
};
const SKIP_OPTION_KEYS: Record<(typeof SKIP_OPTIONS)[number], MessageKey> = {
  never: 'studyModes.step.opt.skip.never',
  'non-i1': 'studyModes.step.opt.skip.nonI1',
};

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
    optionLabel: (option: StudyStep[K]) => string,
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
            {optionLabel(option)}
          </Chip>
        ))}
      </HStack>
    </div>
  );

  return (
    <div className={styles.stepRow} data-cell-id={`step-row-${index}`}>
      <VStack gap="2" className={styles.stepOptions}>
        {OptionGroup(
          t('studyModes.step.subtitle'),
          SUBTITLE_OPTIONS,
          step.subtitle,
          'subtitle',
          (option) => t(SUBTITLE_OPTION_KEYS[option]),
        )}
        {OptionGroup(
          t('studyModes.step.pause'),
          PAUSE_OPTIONS,
          step.pause,
          'pause',
          (option) => t(PAUSE_OPTION_KEYS[option]),
        )}
        {OptionGroup(t('studyModes.step.repeat'), REPEAT_OPTIONS, step.repeat, 'repeat', String)}
        {OptionGroup(t('studyModes.step.speed'), SPEED_OPTIONS, step.speed, 'speed', (option) => `${option}×`)}
        {OptionGroup(
          t('studyModes.step.after'),
          AFTER_OPTIONS,
          step.after,
          'after',
          (option) => t(AFTER_OPTION_KEYS[option]),
        )}
        {index === 0 && (
          <div className={styles.stepOption} role="group" aria-label={t('studyModes.step.skip')}>
            <Text as="span" variant="label" color="secondary" className={styles.stepOptionLabel}>
              {t('studyModes.step.skip')}
            </Text>
            <HStack gap="1" className={styles.stepChipGroup}>
              {SKIP_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  as="button"
                  size="sm"
                  selected={(step.skip ?? 'never') === option}
                  onClick={() => onChange({ ...step, skip: option === 'never' ? undefined : option })}
                  data-cell-id={`step-${index}-skip-${option}`}
                >
                  {t(SKIP_OPTION_KEYS[option])}
                </Chip>
              ))}
            </HStack>
          </div>
        )}
      </VStack>
      {onRemove && (
        <Button
          size="xs"
          variant="ghost"
          onClick={onRemove}
          aria-label={t('studyModes.builder.removeStepAria', [index + 1])}
          data-cell-id={`remove-step-${index}`}
          leadingIcon={<Icon name="trash" size="xs" />}
        />
      )}
    </div>
  );
}
