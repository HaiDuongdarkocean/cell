// OcrSettingsPanel — T17-T20. Manager Panel UI for OCR toggle + config.
// spec §AD4: Per-origin OCR enable toggle, language mode, subtitle region %.

import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { Toggle } from '@/shared/ui';
import {
  loadOcrSettings,
  saveOcrSettings,
  getOcrPreference,
  clearOcrPreference,
  setOcrPreference,
  extractOriginFromUrl,
  type OcrSettings,
  type OcrOriginState,
} from '@/features/ocr/persistence/ocrStateStore';
import { DEFAULT_OCR_ORIGIN_STATE } from '@/features/ocr/persistence/ocrStateTypes';
import styles from './OcrSettingsPanel.module.css';

export interface OcrSettingsPanelProps {
  /** Current page URL — used to determine origin. */
  readonly url: string;
}

export function OcrSettingsPanel({ url }: OcrSettingsPanelProps): ReactElement {
  const [settings, setSettings] = useState<OcrSettings | null>(null);
  const [origin, setOrigin] = useState('');
  const [ocrState, setOcrState] = useState<OcrOriginState | undefined>(undefined);

  // Load settings once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await loadOcrSettings();
      const org = extractOriginFromUrl(url);
      if (cancelled) return;
      setSettings(s);
      setOrigin(org);
      setOcrState(getOcrPreference(s, org));
    })();
    return () => { cancelled = true; };
  }, [url]);

  const handleToggle = useCallback(async (enabled: boolean) => {
    // Optimistic update — update state immediately, then persist.
    const currentSettings = settings ?? { schemaVersion: 1, origins: {} };
    const currentState = ocrState ?? DEFAULT_OCR_ORIGIN_STATE;
    const newState = { ...currentState, ocrEnabled: enabled };
    setOcrState(newState);
    const next = enabled
      ? setOcrPreference(currentSettings, origin, newState)
      : clearOcrPreference(currentSettings, origin);
    setSettings(next);
    setOrigin(origin);
    await saveOcrSettings(next);
  }, [settings, origin, ocrState]);

  const handleLanguageModeChange = useCallback(async (mode: OcrOriginState['languageMode']) => {
    if (!settings || !origin || !ocrState) return;
    const next = setOcrPreference(settings, origin, { ...ocrState, languageMode: mode });
    await saveOcrSettings(next);
    setSettings(next);
    setOcrState(getOcrPreference(next, origin));
  }, [settings, origin, ocrState]);

  const handleRegionPctChange = useCallback(async (pct: number) => {
    if (!settings || !origin || !ocrState) return;
    const clamped = Math.max(5, Math.min(50, pct));
    const next = setOcrPreference(settings, origin, { ...ocrState, subtitleRegionPct: clamped });
    await saveOcrSettings(next);
    setSettings(next);
    setOcrState(getOcrPreference(next, origin));
  }, [settings, origin, ocrState]);

  const enabled = ocrState?.ocrEnabled ?? false;

  // Debug: log render state when enabled but config not showing.
  // ponytail: remove after verifying in browser test.

  return (
    <div className={styles.container} data-testid="ocr-settings-panel" data-enabled={enabled}>
      <div className={styles.header}>
        <h3 className={styles.title}>OCR Subtitles</h3>
        <Toggle
          checked={enabled}
          onChange={handleToggle}
          ariaLabel="Toggle OCR for this site"
          dataTestId="ocr-toggle"
        />
      </div>
      {enabled && (
        <div className={styles.config}>
          <label className={styles.field}>
            <span className={styles.label}>Language</span>
            <select
              className={styles.select}
              value={ocrState?.languageMode ?? DEFAULT_OCR_ORIGIN_STATE.languageMode}
              onChange={(e) => void handleLanguageModeChange(e.target.value as OcrOriginState['languageMode'])}
              data-testid="ocr-language-mode"
            >
              <option value="auto">Auto-detect</option>
              <option value="zh">Chinese</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Subtitle region: {ocrState?.subtitleRegionPct ?? DEFAULT_OCR_ORIGIN_STATE.subtitleRegionPct}%</span>
            <input
              className={styles.slider}
              type="range"
              min={5}
              max={50}
              value={ocrState?.subtitleRegionPct ?? DEFAULT_OCR_ORIGIN_STATE.subtitleRegionPct}
              onChange={(e) => void handleRegionPctChange(Number(e.target.value))}
              data-testid="ocr-region-pct"
            />
          </label>
          <p className={styles.hint}>
            OCR detects burned-in subtitles in video frames and makes them clickable for dictionary lookup.
            Works on sites without native subtitle tracks.
          </p>
        </div>
      )}
    </div>
  );
}
