import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './Stepper.module.css';

export interface StepperProps {
  /** Center slot — a value display, an input, or any custom control. */
  readonly children: ReactNode;
  /** Content of the decrease button (text or icon). */
  readonly decreaseLabel: ReactNode;
  /** Content of the increase button (text or icon). */
  readonly increaseLabel: ReactNode;
  readonly decreaseAriaLabel: string;
  readonly increaseAriaLabel: string;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
  readonly decreaseDisabled?: boolean;
  readonly increaseDisabled?: boolean;
  readonly decreaseDataTihokaId?: string;
  readonly increaseDataTihokaId?: string;
  readonly dataTihokaId?: string;
  readonly className?: string;
}

export function Stepper({
  children,
  decreaseLabel,
  increaseLabel,
  decreaseAriaLabel,
  increaseAriaLabel,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  increaseDisabled,
  decreaseDataTihokaId,
  increaseDataTihokaId,
  dataTihokaId,
  className,
}: StepperProps): React.JSX.Element {
  return (
    <div
      className={className ? `${styles.group} ${className}` : styles.group}
      data-tihoka-id={dataTihokaId}
    >
      <Button
        variant="ghost"
        size="md"
        aria-label={decreaseAriaLabel}
        disabled={decreaseDisabled}
        data-tihoka-id={decreaseDataTihokaId}
        onClick={onDecrease}
      >
        <span className={styles.stepLabel}>{decreaseLabel}</span>
      </Button>
      {children}
      <Button
        variant="ghost"
        size="md"
        aria-label={increaseAriaLabel}
        disabled={increaseDisabled}
        data-tihoka-id={increaseDataTihokaId}
        onClick={onIncrease}
      >
        <span className={styles.stepLabel}>{increaseLabel}</span>
      </Button>
    </div>
  );
}
