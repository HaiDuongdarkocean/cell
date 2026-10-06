import type { ReactNode } from 'react';
import { Stepper, type StepperProps } from './Stepper';
import styles from './StepperSection.module.css';

export function StepperValue({
  children,
  dataCellId,
}: {
  readonly children: ReactNode;
  readonly dataCellId?: string;
}): React.JSX.Element {
  return (
    <span className={styles.value} data-cell-id={dataCellId}>
      {children}
    </span>
  );
}

export interface StepperSectionProps extends Omit<StepperProps, 'className' | 'children'> {
  readonly label: string;
  readonly status?: ReactNode;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
  readonly stepperClassName?: string;
}

export function StepperSection({
  label,
  status,
  trailing,
  children,
  stepperClassName,
  ...stepperProps
}: StepperSectionProps): React.JSX.Element {
  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {status && <span className={styles.status}>{status}</span>}
      </div>
      <div className={styles.row}>
        <Stepper
          {...stepperProps}
          className={stepperClassName ? `${styles.stepper} ${stepperClassName}` : styles.stepper}
        >
          {children}
        </Stepper>
        {trailing}
      </div>
    </div>
  );
}
