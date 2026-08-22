// OcrSettingsPanel — T17-T20. Manager Panel UI for OCR toggle + config.
// spec §AD4: Per-origin OCR enable toggle, language mode, subtitle region %.
// UI: iOS Settings card style — matches SubtitleBlockSettingsPanel pattern.

import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { Toggle, Select, SliderRow, Button, Icon, Tooltip, LabelGroup, SettingsRow } from '@/shared/ui';
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
import { DEFAULT_OCR_ORIGIN_STATE, type CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { formatPct, defaultBottomRegion } from '@/features/ocr/overlay/regionSelector';
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

  // ─── Region slider handlers (X, Y, W, H in %) ───
  // Works in both default + custom mode. In default mode, moving any slider
  // promotes to a custom region (derived from defaultBottomRegion).
  // Slider max props already prevent invalid combinations (W max = 100-xPct,
  // X max = 100-widthPct). Handler only does basic range clamping.
  const handleRegionSliderChange = useCallback(async (patch: Partial<CustomRegion>) => {
    if (!settings || !origin || !ocrState) return;
    const base = ocrState.customRegion ?? defaultBottomRegion(ocrState.subtitleRegionPct, ocrState.subtitleRegionWidthPct);
    const updated: CustomRegion = {
      xPct: Math.max(0, Math.min(100, patch.xPct ?? base.xPct)),
      yPct: Math.max(0, Math.min(100, patch.yPct ?? base.yPct)),
      widthPct: Math.max(1, Math.min(100, patch.widthPct ?? base.widthPct)),
      heightPct: Math.max(1, Math.min(100, patch.heightPct ?? base.heightPct)),
    };
    const next = setOcrPreference(settings, origin, { ...ocrState, customRegion: updated });
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
  const languageMode = ocrState?.languageMode ?? DEFAULT_OCR_ORIGIN_STATE.languageMode;
  const hasCustomRegion = ocrState?.customRegion != null;
  // Effective region: custom if set, otherwise derived from default bottom region.
  const effRegion: CustomRegion = ocrState?.customRegion
    ?? defaultBottomRegion(
      ocrState?.subtitleRegionPct ?? DEFAULT_OCR_ORIGIN_STATE.subtitleRegionPct,
      ocrState?.subtitleRegionWidthPct ?? DEFAULT_OCR_ORIGIN_STATE.subtitleRegionWidthPct,
    );

  return (
    <div className={styles.container} data-testid="ocr-settings-panel" data-enabled={enabled}>
      {/* ─── Toggle card — label group (icon + label + info) + toggle ─── */}
      <div className={styles.card}>
        <SettingsRow>
          <LabelGroup
            icon={<Icon name="scanText" size="sm" />}
            label="Detect burned-in subtitles"
            trailing={
              <button
                type="button"
                className={styles.infoBtn}
                aria-label="What is OCR?"
                aria-expanded={hintOpen}
                data-cell-id="ocr-info-btn"
                onClick={() => setHintOpen((v) => !v)}
              >
                <Icon name="info" size="sm" />
              </button>
            }
          />
          <Toggle
            checked={enabled}
            onChange={handleToggle}
            ariaLabel="Toggle OCR for this site"
            dataTestId="ocr-toggle"
            size="sm"
          />
        </SettingsRow>
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
        <SettingsRow divider>
          <LabelGroup
            icon={<Icon name="languages" size="sm" />}
            label="Language"
          />
          <Select
            value={languageMode}
            options={LANGUAGE_OPTIONS}
            onChange={(v) => void handleLanguageModeChange(v)}
            aria-label="OCR language"
            data-cell-id="ocr-language-mode"
            menuAlign="right"
          />
        </SettingsRow>

          {/* Region sliders — X, Y, W, H in % (always visible) */}
          <SliderRow
            icon={<Icon name="moveHorizontal" size="sm" />}
            label="Position X"
            hint="Horizontal offset from left edge"
            value={effRegion.xPct}
            min={0}
            max={Math.max(0, 100 - effRegion.widthPct)}
            step={1}
            onChange={(v) => void handleRegionSliderChange({ xPct: v })}
            aria-label="Region X position"
            variant="end"
            divider
            disabled={100 - effRegion.widthPct <= 0}
            disabledNote="Reduce Width to move horizontally"
            formatValue={(v) => `${formatPct(v)}%`}
          />
          <SliderRow
            icon={<Icon name="moveVertical" size="sm" />}
            label="Position Y"
            hint="Vertical offset from top edge"
            value={effRegion.yPct}
            min={0}
            max={Math.max(0, 100 - effRegion.heightPct)}
            step={1}
            onChange={(v) => void handleRegionSliderChange({ yPct: v })}
            aria-label="Region Y position"
            variant="end"
            divider
            disabled={100 - effRegion.heightPct <= 0}
            disabledNote="Reduce Height to move vertically"
            formatValue={(v) => `${formatPct(v)}%`}
          />
          <SliderRow
            icon={<Icon name="moveHorizontal" size="sm" />}
            label="Width"
            hint="Horizontal capture range"
            value={effRegion.widthPct}
            min={1}
            max={Math.max(1, 100 - effRegion.xPct)}
            step={1}
            onChange={(v) => void handleRegionSliderChange({ widthPct: v })}
            aria-label="Region width"
            variant="end"
            divider
            disabled={100 - effRegion.xPct <= 1}
            disabledNote="Reduce Position X to widen"
            formatValue={(v) => `${formatPct(v)}%`}
          />
          <SliderRow
            icon={<Icon name="moveVertical" size="sm" />}
            label="Height"
            hint="Vertical capture range"
            value={effRegion.heightPct}
            min={1}
            max={Math.max(1, 100 - effRegion.yPct)}
            step={1}
            onChange={(v) => void handleRegionSliderChange({ heightPct: v })}
            aria-label="Region height"
            variant="end"
            divider
            disabled={100 - effRegion.yPct <= 1}
            disabledNote="Reduce Position Y to heighten"
            formatValue={(v) => `${formatPct(v)}%`}
          />

          {/* Region action buttons — icon+label, collapse to icon-only on narrow container */}
          <SettingsRow stacked divider>
            <div className={styles.regionButtons}>
              <Tooltip content="Select Region" placement="top">
                <Button
                  variant="outline"
                  size="sm"
                  collapseLabel
                  leadingIcon={<Icon name="crop" size="sm" />}
                  onClick={() => sendRegionCommand('select')}
                  data-cell-id="ocr-region-select"
                >
                  Select Region
                </Button>
              </Tooltip>
              {hasCustomRegion && (
                <Tooltip content="Edit" placement="top">
                  <Button
                    variant="outline"
                    size="sm"
                    collapseLabel
                    leadingIcon={<Icon name="move" size="sm" />}
                    onClick={() => sendRegionCommand('edit')}
                    data-cell-id="ocr-region-edit"
                  >
                    Edit
                  </Button>
                </Tooltip>
              )}
              <Tooltip content="Reset" placement="top">
                <Button
                  variant="ghost"
                  size="sm"
                  collapseLabel
                  leadingIcon={<Icon name="rotateCcw" size="sm" />}
                  onClick={() => void handleResetRegion()}
                  data-cell-id="ocr-region-reset"
                >
                  Reset
                </Button>
              </Tooltip>
            </div>
          </SettingsRow>
        </div>
      )}
    </div>
  );
}
