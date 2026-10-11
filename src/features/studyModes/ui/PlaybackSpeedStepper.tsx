import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/entities/studyMode/types';
import { t } from '@/shared/i18n';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { StepperSection, StepperValue } from '@/shared/ui/StepperSection';

const RESET_SPEED: PlaybackSpeed = 1;

export interface PlaybackSpeedStepperProps {
  readonly value: PlaybackSpeed;
  readonly onChange: (speed: PlaybackSpeed) => void;
  readonly idPrefix: string;
}

export function PlaybackSpeedStepper({
  value,
  onChange,
  idPrefix,
}: PlaybackSpeedStepperProps): React.JSX.Element {
  const index = Math.max(PLAYBACK_SPEEDS.indexOf(value), 0);
  const step = (delta: number): void => {
    const next = PLAYBACK_SPEEDS[index + delta];
    if (next !== undefined) onChange(next);
  };
  return (
    <StepperSection
      label={t('studyModes.speed.aria')}
      dataCellId={`${idPrefix}-stepper`}
      decreaseLabel={<Icon name="minus" />}
      increaseLabel={<Icon name="plus" />}
      decreaseAriaLabel={t('studyModes.speed.decrease', [String(value)])}
      increaseAriaLabel={t('studyModes.speed.increase', [String(value)])}
      decreaseDisabled={index <= 0}
      increaseDisabled={index >= PLAYBACK_SPEEDS.length - 1}
      decreaseDataCellId={`${idPrefix}-dec`}
      increaseDataCellId={`${idPrefix}-inc`}
      onDecrease={() => step(-1)}
      onIncrease={() => step(1)}
      trailing={
        <Button
          variant="ghost"
          size="md"
          aria-label={t('studyModes.speed.reset')}
          disabled={value === RESET_SPEED}
          data-cell-id={`${idPrefix}-reset`}
          onClick={() => onChange(RESET_SPEED)}
        >
          <Icon name="rotateCcw" />
        </Button>
      }
    >
      <StepperValue dataCellId={`${idPrefix}-value`}>{`${value}×`}</StepperValue>
    </StepperSection>
  );
}
