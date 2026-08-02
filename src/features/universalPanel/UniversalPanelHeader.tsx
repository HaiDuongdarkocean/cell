import type { ReactElement } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { Toggle } from '@/shared/ui/Toggle';
import { Icon } from '@/shared/icons/Icon';
import type { TokenizePanelState } from '@/features/tokenize/types';
import styles from './UniversalPanelHeader.module.css';

export interface UniversalPanelHeaderProps {
  /** Tokenize runtime state (enabled + showStatus + showFrequency). */
  readonly tokenizeState: TokenizePanelState;
  /** Toggle one of the three tokenize keys. */
  readonly onToggleTokenize: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
  /** Called when the close button is clicked. */
  readonly onClose: () => void;
}

type TokenizeKey = 'enabled' | 'showStatus' | 'showFrequency';

interface ToggleItem {
  readonly key: TokenizeKey;
  readonly label: string;
  readonly ariaLabel: string;
}

const TOGGLE_ITEMS: readonly ToggleItem[] = [
  { key: 'showStatus', label: 'Status', ariaLabel: 'Toggle status badges' },
  { key: 'showFrequency', label: 'Frequency', ariaLabel: 'Toggle frequency bands' },
  { key: 'enabled', label: 'Tokenize', ariaLabel: 'Toggle tokenize page' },
];

/**
 * UniversalPanelHeader — minimal horizontal header above the panel content.
 *
 * Layout (left → right): `[Status][Frequency][Tokenize]` cluster (3 toggles,
 * Tokenize closest to close) … gap … `[close]` (right edge).
 *
 * `Tokenize` is always interactive; `Status` + `Frequency` are disabled while
 * tokenize is off (per ADR-061 tokenize gating). Applies to both Dictionary
 * and Settings tabs — universal, not tab-scoped.
 */
export function UniversalPanelHeader({
  tokenizeState,
  onToggleTokenize,
  onClose,
}: UniversalPanelHeaderProps): ReactElement {
  const tokenizeOff = !tokenizeState.enabled;

  return (
    <header className={styles.header} data-cell-id="universal-panel-header">
      <div className={styles.toggleCluster} role="group" aria-label="Tokenize controls">
        {TOGGLE_ITEMS.map((item) => {
          const checked = tokenizeState[item.key];
          const disabled = item.key !== 'enabled' && tokenizeOff;
          return (
            <label key={item.key} className={styles.toggleField}>
              <span className={styles.toggleLabel}>{item.label}</span>
              <Toggle
                checked={checked}
                onChange={() => onToggleTokenize(item.key)}
                ariaLabel={item.ariaLabel}
                title={`${item.label}: ${checked ? 'ON' : 'OFF'}`}
                disabled={disabled}
                dataTestId={`universal-panel-header-toggle-${item.key}`}
              />
            </label>
          );
        })}
      </div>

      <IconButton
        size="sm"
        variant="ghost"
        aria-label="Close panel"
        className={styles.closeButton}
        onClick={onClose}
        data-cell-id="universal-panel-close"
      >
        <Icon name="x" size={20} />
      </IconButton>
    </header>
  );
}
