// OcrSettingsPanel — T17-T20. Manager Panel UI for OCR toggle + config.
// spec §AD4: Per-origin OCR enable toggle, language mode, subtitle region %.
// UI: iOS Settings card style — matches SubtitleBlockSettingsPanel pattern.

import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { Toggle, Select, Slider, Button, Icon } from '@/shared/ui';
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
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { formatPct } from '@/features/ocr/overlay/regionSelector';
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

  // Listen for region-select results (Apply/Cancel) from content script.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      if (changes.__ocrRegionResult?.newValue) {
        // Reload settings to pick up applied region.
        void (async () => {
          const s = await loadOcrSettings();
          const org = extractOriginFromUrl(url);
          setSettings(s);
          setOcrState(getOcrPreference(s, org));
        })();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [url]);

  const handleToggle = useCallback(async (enabled: boolean) => {
    const currentSettings = settings ?? { schemaVersion: 1, origins: {} };
    const currentState = ocrState ?? DEFAULT_OCR_ORIGIN_STATE;
    const newState = { ...currentState, ocrEnabled: enabled };
    setOcrState(newState);
    const next = enabled
      ? setOcrPreference(currentSettings, origin, newState)
      : clearOcrPreference(currentSettings, origin);
    setSettings(next);
    await saveOcrSettings(next);
  }, [settings, origin, ocrState]);

  const handleLanguageModeChange = useCallback(async (mode: string) => {
    if (!settings || !origin || !ocrState) return;
    const next = setOcrPreference(settings, origin, { ...ocrState, languageMode: mode as OcrOriginState['languageMode'] });
    await saveOcrSettings(next);
    setSettings(next);
    setOcrState(getOcrPreference(next, origin));
  }, [settings, origin, ocrState]);

  const handleRegionHeightChange = useCallback(async (pct: number) => {
    if (!settings || !origin || !ocrState) return;
    const clamped = Math.max(5, Math.min(50, pct));
    const next = setOcrPreference(settings, origin, { ...ocrState, subtitleRegionPct: clamped });
    await saveOcrSettings(next);
    setSettings(next);
    setOcrState(getOcrPreference(next, origin));
  }, [settings, origin, ocrState]);

  const handleRegionWidthChange = useCallback(async (pct: number) => {
    if (!settings || !origin || !ocrState) return;
    const clamped = Math.max(10, Math.min(100, pct));
    const next = setOcrPreference(settings, origin, { ...ocrState, subtitleRegionWidthPct: clamped });
    await saveOcrSettings(next);
    setSettings(next);
    setOcrState(getOcrPreference(next, origin));
  }, [settings, origin, ocrState]);

  const sendRegionCommand = useCallback((mode: 'select' | 'edit' | 'view' | 'reset') => {
    void sendMessage({ type: MESSAGE_TYPES.OCR_REGION_COMMAND, payload: { mode } });
  }, []);

  const handleResetRegion = useCallback(async () => {
    if (!settings || !origin || !ocrState) return;
    sendRegionCommand('reset');
    const next = setOcrPreference(settings, origin, { ...ocrState, customRegion: null });
    await saveOcrSettings(next);
    setSettings(next);
    setOcrState(getOcrPreference(next, origin));
  }, [settings, origin, ocrState, sendRegionCommand]);

  const enabled = ocrState?.ocrEnabled ?? false;
  const regionPct = ocrState?.subtitleRegionPct ?? DEFAULT_OCR_ORIGIN_STATE.subtitleRegionPct;
  const regionWidthPct = ocrState?.subtitleRegionWidthPct ?? DEFAULT_OCR_ORIGIN_STATE.subtitleRegionWidthPct;
  const languageMode = ocrState?.languageMode ?? DEFAULT_OCR_ORIGIN_STATE.languageMode;
  const hasCustomRegion = ocrState?.customRegion != null;

  return (
    <div className={styles.container} data-testid="ocr-settings-panel" data-enabled={enabled}>
      {/* ─── Toggle card — label group (icon + label + info) + toggle ─── */}
      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <span className={styles.labelGroup}>
            <span className={styles.rowIcon} aria-hidden="true">
              <Icon name="scanText" />
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

          {/* Region sliders — only in default mode (no custom region) */}
          {!hasCustomRegion && (
            <>
              <div className={styles.rowStack}>
                <div className={styles.sliderHeader}>
                  <span className={styles.labelGroup}>
                    <span className={styles.rowIcon} aria-hidden="true">
                      <Icon name="moveVertical" />
                    </span>
                    <span className={styles.rowLabel}>Scan height</span>
                  </span>
                  <span className={styles.sliderValue}>{regionPct}%</span>
                </div>
                <Slider
                  value={regionPct}
                  min={5}
                  max={50}
                  step={1}
                  onChange={(v) => void handleRegionHeightChange(v)}
                  aria-label="Subtitle scan region height"
                />
                <p className={styles.sliderHint}>Bottom {regionPct}% of the video frame</p>
              </div>

              <div className={styles.rowStack}>
                <div className={styles.sliderHeader}>
                  <span className={styles.labelGroup}>
                    <span className={styles.rowIcon} aria-hidden="true">
                      <Icon name="moveHorizontal" />
                    </span>
                    <span className={styles.rowLabel}>Scan width</span>
                  </span>
                  <span className={styles.sliderValue}>{regionWidthPct}%</span>
                </div>
                <Slider
                  value={regionWidthPct}
                  min={10}
                  max={100}
                  step={1}
                  onChange={(v) => void handleRegionWidthChange(v)}
                  aria-label="Subtitle scan region width"
                />
                <p className={styles.sliderHint}>Centered {regionWidthPct}% of the video width</p>
              </div>
            </>
          )}

          {/* Custom region info — shown when custom region exists */}
          {hasCustomRegion && (
            <div className={styles.rowStack}>
              <div className={styles.sliderHeader}>
                <span className={styles.labelGroup}>
                  <span className={styles.rowIcon} aria-hidden="true">
                    <Icon name="crop" />
                  </span>
                  <span className={styles.rowLabel}>Custom region</span>
                </span>
              </div>
              <p className={styles.sliderHint}>
                {formatPct(ocrState!.customRegion!.widthPct)}%×{formatPct(ocrState!.customRegion!.heightPct)}% at ({formatPct(ocrState!.customRegion!.xPct)}%, {formatPct(ocrState!.customRegion!.yPct)}%)
              </p>
            </div>
          )}

          {/* Region action buttons */}
          <div className={styles.rowStack}>
            <div className={styles.regionButtons}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendRegionCommand('select')}
                data-cell-id="ocr-region-select"
              >
                <Icon name="crop" /> Select Region
              </Button>
              {hasCustomRegion && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendRegionCommand('edit')}
                  data-cell-id="ocr-region-edit"
                >
                  <Icon name="move" /> Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleResetRegion()}
                data-cell-id="ocr-region-reset"
              >
                <Icon name="rotateCcw" /> Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
