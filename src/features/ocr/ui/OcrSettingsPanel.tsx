// OcrSettingsPanel — T17-T20. Manager Panel UI for OCR toggle + config.
// spec §AD4: Per-origin OCR enable toggle, language mode, subtitle region %.
// UI: iOS Settings card style — matches SubtitleBlockSettingsPanel pattern.

import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { Toggle, Select, Slider, Icon } from '@/shared/ui';
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

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'zh', label: 'Chinese' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
];

export interface OcrSettingsPanelProps {
  /** Current page URL — used to determine origin. */
  readonly url: string;
}

export function OcrSettingsPanel({ url }: OcrSettingsPanelProps): ReactElement {
  const [settings, setSettings] = useState<OcrSettings | null>(null);
  const [origin, setOrigin] = useState('');
  const [ocrState, setOcrState] = useState<OcrOriginState | undefined>(undefined);
  const [hintOpen, setHintOpen] = useState(false);

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

  const handleLanguageModeChange = useCallback(async (mode: string) => {
    if (!settings || !origin || !ocrState) return;
    const next = setOcrPreference(settings, origin, { ...ocrState, languageMode: mode as OcrOriginState['languageMode'] });
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
  const regionPct = ocrState?.subtitleRegionPct ?? DEFAULT_OCR_ORIGIN_STATE.subtitleRegionPct;
  const languageMode = ocrState?.languageMode ?? DEFAULT_OCR_ORIGIN_STATE.languageMode;

  return (
    <div className={styles.container} data-testid="ocr-settings-panel" data-enabled={enabled}>
      {/* ─── Toggle card — label group (icon + label + info) + toggle ─── */}
      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <span className={styles.labelGroup}>
            <span className={styles.rowIcon} aria-hidden="true">
              <Icon name="image" />
            </span>
            <span className={styles.rowLabel}>Detect burned-in subtitles</span>
            <button
              type="button"
              className={styles.infoBtn}
              aria-label="What is OCR?"
              aria-expanded={hintOpen}
              data-cell-id="ocr-info-btn"
              onClick={() => setHintOpen((v) => !v)}
            >
              <Icon name="info" />
            </button>
          </span>
          <Toggle
            checked={enabled}
            onChange={handleToggle}
            ariaLabel="Toggle OCR for this site"
            dataTestId="ocr-toggle"
            size="sm"
          />
        </div>
        {/* Inline expandable hint — grid 0fr→1fr, attached to card */}
        <div className={styles.hintRow} data-open={hintOpen}>
          <div className={styles.hintInner}>
            <p className={styles.hintContent}>
              Detects text burned into the video frame and makes it clickable for dictionary lookup.{' '}
              <strong className={styles.hintStrong}>For this site only.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ─── Config card — revealed when OCR enabled ─── */}
      {enabled && (
        <div className={styles.configCard}>
          {/* Language row */}
          <div className={styles.row}>
            <span className={styles.labelGroup}>
              <span className={styles.rowIcon} aria-hidden="true">
                <Icon name="languages" />
              </span>
              <span className={styles.rowLabel}>Language</span>
            </span>
            <Select
              value={languageMode}
              options={LANGUAGE_OPTIONS}
              onChange={(v) => void handleLanguageModeChange(v)}
              aria-label="OCR language"
              data-cell-id="ocr-language-mode"
              menuAlign="right"
            />
          </div>

          {/* Region slider row */}
          <div className={styles.rowStack}>
            <div className={styles.sliderHeader}>
              <span className={styles.labelGroup}>
                <span className={styles.rowIcon} aria-hidden="true">
                  <Icon name="gauge" />
                </span>
                <span className={styles.rowLabel}>Scan region</span>
              </span>
              <span className={styles.sliderValue}>{regionPct}%</span>
            </div>
            <Slider
              value={regionPct}
              min={5}
              max={50}
              step={1}
              onChange={(v) => void handleRegionPctChange(v)}
              aria-label="Subtitle scan region percentage"
            />
            <p className={styles.sliderHint}>Bottom {regionPct}% of the video frame</p>
          </div>
        </div>
      )}
    </div>
  );
}
