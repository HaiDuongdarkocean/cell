import type { ReactElement } from 'react';
import styles from './CaptionToggle.module.css';

export interface CaptionToggleProps {
  /** Current enabled state (controlled). */
  enabled: boolean;
  /** Called when the user toggles captions on/off. */
  onChange: (next: boolean) => void;
  /** Label of the current caption track, e.g. "English". */
  trackLabel: string;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-testid for testing. */
  dataTestId?: string;
  /** When true, toggle is disabled (not clickable, dimmed). */
  disabled?: boolean;
}

/**
 * CaptionToggle — a switch-style toggle for enabling/disabling subtitle
 * captions. Uses `role="switch"` with `aria-checked` and a dynamic
 * `aria-label` that includes the track label and on/off state.
 */
export function CaptionToggle({
  enabled,
  onChange,
  trackLabel,
  id,
  dataTestId,
  disabled,
}: CaptionToggleProps): ReactElement {
  const stateText = enabled ? 'On' : 'Off';
  const ariaLabel = `Captions: ${trackLabel} — ${stateText}`;

  return (
    <button
      type="button"
      id={id}
      data-testid={dataTestId}
      className={styles.captionToggle}
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
    >
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
