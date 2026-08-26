import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';
import styles from './LabelGroup.module.css';

export interface LabelGroupProps {
  /** Leading icon (20×20 slot). */
  icon?: ReactNode;
  /** Primary label text. */
  label: ReactNode;
  /** Secondary text rendered below label — label + sublabel variant. */
  sublabel?: ReactNode;
  /** Hint tooltip on info icon next to label — label + hint variant. */
  hint?: ReactNode;
  /** Trailing element (info button, badge, etc.). */
  trailing?: ReactNode;
  /** Extra class on the root span. */
  className?: string;
}

/**
 * LabelGroup — icon + label + (sublabel | hint) + trailing, for settings rows.
 *
 * Two label variants:
 * - **Label + sublabel**: `sublabel` text stacked below label (vertical).
 * - **Label + hint**: `hint` text shown in a Tooltip on an info icon next to label (inline).
 *
 * Icon sits left, trailing sits right. Consumes tokens only.
 */
export function LabelGroup({
  icon,
  label,
  sublabel,
  hint,
  trailing,
  className,
}: LabelGroupProps): React.JSX.Element {
  return (
    <span className={[styles.labelGroup, className ?? ''].filter(Boolean).join(' ')}>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span className={styles.text}>
        <span className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          {hint && (
            <Tooltip content={hint} placement="top">
              <span className={styles.hintIcon} role="img" aria-label="More info">
                <Icon name="info" size="sm" />
              </span>
            </Tooltip>
          )}
        </span>
        {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </span>
  );
}
