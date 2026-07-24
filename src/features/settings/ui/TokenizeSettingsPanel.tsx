import type { ReactElement } from 'react';
import { Toggle } from '@/shared/ui/Toggle';
import { Button } from '@/shared/ui/Button';
import { HintIcon } from '@/shared/ui/HintIcon';
import { Icon } from '@/shared/icons/Icon';
import styles from './TokenizeSettingsPanel.module.css';

/** Tokenize runtime state (in-memory, not persisted in Settings). */
export interface TokenizePanelState {
  readonly enabled: boolean;
  readonly showStatus: boolean;
  readonly showFrequency: boolean;
}

interface TokenizeSettingsPanelProps {
  readonly state: TokenizePanelState;
  readonly onToggle: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
  readonly onOpenDictionary?: () => void;
}

/** Tokenize settings panel (ADR-061). Shown only in the orbital badge's
 *  SettingsDialog — not in popup/sidepanel/options (tokenize is a
 *  content-script-only feature). Uses the same design system components
 *  (Toggle, Button, HintIcon) as the other settings panels. */
export function TokenizeSettingsPanel({
  state,
  onToggle,
  onOpenDictionary,
}: TokenizeSettingsPanelProps): ReactElement {
  return (
    <div className={styles.container} data-testid="tokenize-settings-panel">
      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <span className={styles.rowLabel}>
            Status badges
            <HintIcon
              hint="Hiển thị trạng thái từ (known/tracking/unknown) trên token badges."
              ariaLabel="Show hint for Status badges"
            />
          </span>
          <Toggle
            checked={state.showStatus}
            onChange={() => onToggle('showStatus')}
            ariaLabel="Toggle status badges"
            title={`Status: ${state.showStatus ? 'ON' : 'OFF'}`}
            disabled={!state.enabled}
          />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldRow}>
          <span className={styles.rowLabel}>
            Frequency bands
            <HintIcon
              hint="Hiển thị băng tần tần suất từ (hot/common/rare) trên token badges."
              ariaLabel="Show hint for Frequency bands"
            />
          </span>
          <Toggle
            checked={state.showFrequency}
            onChange={() => onToggle('showFrequency')}
            ariaLabel="Toggle frequency bands"
            title={`Frequency: ${state.showFrequency ? 'ON' : 'OFF'}`}
            disabled={!state.enabled}
          />
        </div>
      </div>

      {onOpenDictionary && (
        <>
          <div className={styles.divider} />
          <div className={styles.actionRow}>
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenDictionary}
              disabled={!state.enabled}
              leadingIcon={<Icon name="search" size={16} />}
              data-testid="tokenize-open-dictionary"
            >
              Open Dictionary
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
