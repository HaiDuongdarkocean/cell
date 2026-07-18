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
    <div className={styles.container} data-testid="card-creator-settings-panel">
      {/* AnkiConnect URL */}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cc-anki-url">
          AnkiConnect URL
        </label>
        <input
          id="cc-anki-url"
          className={styles.urlInput}
          type="text"
          value={settings.ankiConnectUrl}
          onChange={handleUrlChange}
          placeholder="http://localhost:8765"
          aria-label="AnkiConnect URL"
          data-testid="cc-anki-url-input"
        />
        <p className={styles.hint}>
          Default: localhost:8765. Change to your PC&apos;s IP address when using Kiwi or Edge on mobile.
        </p>
      </div>

      {/* Connection status bar */}
      <div className={styles.connectionStatus}>
        <div
          className={`${styles.statusIndicator} ${indicatorClass}`}
          aria-live="polite"
          data-testid="cc-connection-status"
        >
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusLabel}>{statusLabel(status)}</span>
          <span className={styles.statusDetail}>
            {buildStatusDetail(status, version, settings.ankiConnectUrl)}
          </span>
        </div>
        <button
          type="button"
          className={styles.testButton}
          onClick={handleTest}
          disabled={status === 'testing'}
          aria-label="Test AnkiConnect connection again"
          data-testid="cc-test-again-button"
        >
          {status === 'testing' ? 'Testing…' : 'Test again'}
        </button>
      </div>

      {/* Auto-complete toggles (spec §9.3.1, D7 — schema v14) */}
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Quick Add auto-complete</label>
        <p className={styles.hint}>
          When ON, Quick Add auto-fills the field with best-match items. When OFF, only user-ticked items are filled.
        </p>
        <div className={styles.toggleList} role="list">
          {(['definitions', 'wordAudios', 'sentenceAudios', 'images', 'sentenceTranslation', 'sentence'] as const).map((field) => (
            <label key={field} className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.autoCompleteToggles?.[field] ?? true}
                onChange={(e) => {
                  const toggles = { ...(settings.autoCompleteToggles ?? {}), [field]: e.target.checked };
                  onChange({ autoCompleteToggles: toggles as Record<AutoCompletableField, boolean> });
                }}
              />
              {field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
            </label>
          ))}
        </div>
      </div>

      {/* Audio fallback strategy (spec §9.3.1) */}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cc-audio-fallback">
          Audio fallback
        </label>
        <select
          id="cc-audio-fallback"
          className={styles.urlInput}
          value={settings.audioFallback ?? 'community-then-tts'}
          onChange={(e) => onChange({ audioFallback: e.target.value as AudioFallbackStrategy })}
          aria-label="Audio fallback strategy"
        >
          <option value="community-then-tts">Community → TTS (recommended)</option>
          <option value="community-only">Community only</option>
          <option value="tts-only">TTS only</option>
        </select>
        <p className={styles.hint}>
          What to use when community audio is unavailable or fails to load.
        </p>
      </div>
    </div>
  );
}
