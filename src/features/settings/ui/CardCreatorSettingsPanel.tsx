/**
 * Card Creator settings panel — Connection section only (schema v10).
 *
 * Per the approved mockup, the Card Creator settings contain ONLY the
 * Connection section (URL input + status bar + "Test again" button).
 * Defaults (deck, note type, tags) and field mapping are configured inline
 * in the Card Creator dialog, not here.
 *
 * The status bar shows: status dot (online/offline/testing) + label +
 * detail (Anki version + URL). "Test again" re-runs the connection test.
 *
 * Accessibility: label htmlFor, aria-label on inputs + buttons, keyboard-
 * navigable. Status announced via aria-live="polite".
 */
import { useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import type { CardCreatorSettings, AutoCompletableField, AudioFallbackStrategy } from '@/entities/settings';
import { testConnection } from '@/features/cardCreator/service/cardCreatorService';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { Toggle } from '@/shared/ui/Toggle';
import { Text } from '@/shared/ui/Text';
import styles from './CardCreatorSettingsPanel.module.css';

interface CardCreatorSettingsPanelProps {
  /** Current Card Creator settings. */
  settings: CardCreatorSettings;
  /** Called with partial settings update whenever a control changes. */
  onChange: (partial: Partial<CardCreatorSettings>) => void;
}

/** Connection status state machine. */
type ConnectionStatus = 'idle' | 'testing' | 'online' | 'offline';

/** Detail string shown next to the status label. */
function buildStatusDetail(
  status: ConnectionStatus,
  version: number | null,
  url: string,
): string {
  if (status === 'testing') return 'Testing…';
  if (status === 'offline') return 'Cannot reach AnkiConnect';
  if (status === 'online' && version !== null) {
    return `Anki v2.1 · ${shortUrl(url)}`;
  }
  return shortUrl(url);
}

/** Strip protocol for compact display. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/** Human-readable status label. */
function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'testing':
      return 'Testing';
    case 'online':
      return 'Connected';
    case 'offline':
      return 'Disconnected';
    case 'idle':
    default:
      return 'Not tested';
  }
}

export function CardCreatorSettingsPanel({
  settings,
  onChange,
}: CardCreatorSettingsPanelProps): ReactElement {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [version, setVersion] = useState<number | null>(null);

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ankiConnectUrl: e.target.value });
      // Reset status when URL changes — must re-test.
      setStatus('idle');
      setVersion(null);
    },
    [onChange],
  );

  const handleTest = useCallback(async () => {
    setStatus('testing');
    const r = await testConnection(settings.ankiConnectUrl);
    if (r.ok) {
      setVersion(r.value);
      setStatus('online');
    } else {
      setVersion(null);
      setStatus('offline');
    }
  }, [settings.ankiConnectUrl]);

  const indicatorClass =
    status === 'online'
      ? styles.online
      : status === 'offline'
        ? styles.offline
        : status === 'testing'
          ? styles.testing
          : '';

  return (
    <div className={styles.container} data-cell-id="card-creator-settings-panel">
      {/* AnkiConnect URL */}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cc-anki-url">
          AnkiConnect URL
        </label>
        <Input
          id="cc-anki-url"
          type="text"
          value={settings.ankiConnectUrl}
          onChange={handleUrlChange}
          placeholder="http://localhost:8765"
          aria-label="AnkiConnect URL"
          data-cell-id="cc-anki-url-input"
        />
        <Text as="p" color="secondary" className={styles.hint}>
          Default: localhost:8765. Change to your PC&apos;s IP address when using Kiwi or Edge on mobile.
        </Text>
      </div>

      {/* Connection status bar */}
      <div className={styles.connectionStatus}>
        <div
          className={`${styles.statusIndicator} ${indicatorClass}`}
          aria-live="polite"
          data-cell-id="cc-connection-status"
        >
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusLabel}>{statusLabel(status)}</span>
          <span className={styles.statusDetail}>
            {buildStatusDetail(status, version, settings.ankiConnectUrl)}
          </span>
        </div>
        <Button material="solid"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={status === 'testing'}
          aria-label="Test AnkiConnect connection again"
          data-cell-id="cc-test-again-button"
        >
          {status === 'testing' ? 'Testing…' : 'Test again'}
        </Button>
      </div>

      {/* Auto-complete toggles (spec §9.3.1, D7 — schema v14) */}
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Quick Add auto-complete</label>
        <Text as="p" color="secondary" className={styles.hint}>
          When ON, Quick Add auto-fills the field with best-match items. When OFF, only user-ticked items are filled.
        </Text>
        <div className={styles.toggleList} role="list">
          {(['definitions', 'wordAudios', 'sentenceAudios', 'images', 'sentenceTranslation', 'sentence'] as const).map((field) => {
            const fieldLabel = field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
            return (
              <div key={field} className={styles.toggleRow}>
                <Toggle
                  checked={settings.autoCompleteToggles?.[field] ?? true}
                  onChange={(next) => {
                    const toggles = { ...(settings.autoCompleteToggles ?? {}), [field]: next };
                    onChange({ autoCompleteToggles: toggles as Record<AutoCompletableField, boolean> });
                  }}
                  ariaLabel={`Auto-complete ${fieldLabel}`}
                  size="sm"
                  dataTestId={`cc-autocomplete-${field}`}
                />
                {fieldLabel}
              </div>
            );
          })}
        </div>
      </div>

      {/* Audio fallback strategy (spec §9.3.1) */}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cc-audio-fallback">
          Audio fallback
        </label>
        <Select
          id="cc-audio-fallback"
          value={settings.audioFallback ?? 'community-then-tts'}
          onChange={(v) => onChange({ audioFallback: v as AudioFallbackStrategy })}
          aria-label="Audio fallback strategy"
          options={[
            { value: 'community-then-tts', label: 'Community → TTS (recommended)' },
            { value: 'community-only', label: 'Community only' },
            { value: 'tts-only', label: 'TTS only' },
          ]}
        />
        <Text as="p" color="secondary" className={styles.hint}>
          What to use when community audio is unavailable or fails to load.
        </Text>
      </div>
    </div>
  );
}
