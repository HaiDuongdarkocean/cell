import type { ReactElement } from 'react';
import { HStack } from '@/shared/ui';
import { IconButton } from '@/shared/ui/IconButton';
import { Toggle } from '@/shared/ui/Toggle';
import { Select } from '@/shared/ui/Select';
import { Icon } from '@/shared/icons/Icon';
import type { TokenizePanelState } from '@/features/tokenize/types';
import styles from './UniversalPanelHeader.module.css';

export interface UniversalPanelHeaderProps {
  /** Tokenize runtime state (enabled + showStatus + showFrequency + subtitleEnabled). */
  readonly tokenizeState: TokenizePanelState;
  /** Toggle one of the four tokenize keys. */
  readonly onToggleTokenize: (key: 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled') => void;
  /** Called when the close button is clicked. */
  readonly onClose: () => void;
  /** Language profiles for quick switch. */
  readonly languageProfiles?: { readonly id: string; readonly name: string }[];
  /** Active profile id. */
  readonly activeProfileId?: string | null;
  /** Called when user switches active profile. */
  readonly onProfileChange?: (profileId: string) => void;
}

type TokenizeKey = 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled';

interface ToggleItem {
  readonly key: TokenizeKey;
  readonly label: string;
  readonly ariaLabel: string;
}

const TOGGLE_ITEMS: readonly ToggleItem[] = [
  { key: 'showStatus', label: 'Status', ariaLabel: 'Toggle status badges' },
  { key: 'showFrequency', label: 'Frequency', ariaLabel: 'Toggle frequency bands' },
  { key: 'subtitleEnabled', label: 'Subtitle', ariaLabel: 'Toggle subtitle tokenize' },
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
  languageProfiles = [],
  activeProfileId = null,
  onProfileChange = () => {},
}: UniversalPanelHeaderProps): ReactElement {
  const tokenizeOff = !tokenizeState.enabled;
  const profileOptions = languageProfiles.map((p) => ({ value: p.id, label: p.name }));
  const activeProfile = languageProfiles.find((p) => p.id === activeProfileId);
  const placeholder = activeProfile?.name ?? 'Select profile';

  return (
    <header className={styles.header} data-cell-id="universal-panel-header">
      {languageProfiles.length > 0 && (
        <Select
          className={styles.profileSelect}
          variant="ghost"
          size="sm"
          value={activeProfileId ?? ''}
          options={profileOptions}
          placeholder={placeholder}
          onChange={onProfileChange}
          aria-label="Switch language profile"
          data-cell-id="universal-panel-profile-switch"
          menuAlign="right"
        />
      )}
      <HStack align="center" gap="3" className={styles.toggleCluster} role="group" aria-label="Tokenize controls">
        {TOGGLE_ITEMS.map((item) => {
          const checked = tokenizeState[item.key];
          // Subtitle toggle is independent — always interactive.
          // Status + Frequency are gated by web tokenize.
          const disabled = item.key !== 'enabled' && item.key !== 'subtitleEnabled' && tokenizeOff;
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
      </HStack>

      <IconButton material="solid"
        size="sm"
        variant="ghost"
        aria-label="Close panel"
        className={styles.closeButton}
        onClick={onClose}
        data-cell-id="universal-panel-close"
      >
        <Icon name="x"  />
      </IconButton>
    </header>
  );
}
