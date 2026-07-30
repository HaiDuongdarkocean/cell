import type { ReactElement } from 'react';
import styles from './TrackLabel.module.css';

export interface TrackLabelProps {
  /** Human-readable track label, e.g. "English". */
  label: string;
  /** BCP-47 language tag, e.g. "en". */
  srclang: string;
  /** Whether this track is the currently active one. */
  active: boolean;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-testid for testing. */
  dataTestId?: string;
  /** Optional extra class name. */
  className?: string;
}

/**
 * TrackLabel — displays a subtitle track's label and language code as an
 * inline `<span>`. When `active` is true, an indicator dot is shown and
 * `aria-current="true"` is set for screen readers.
 */
export function TrackLabel({
  label,
  srclang,
  active,
  id,
  dataTestId,
  className,
}: TrackLabelProps): ReactElement {
  const cls = [
    styles.trackLabel,
    active ? styles.active : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      id={id}
      data-testid={dataTestId}
      className={cls}
      aria-current={active ? 'true' : undefined}
    >
      {active && <span className={styles.dot} aria-hidden="true" />}
      <span className={styles.label}>{label}</span>
      <span className={styles.srclang}>{srclang}</span>
    </span>
  );
}
