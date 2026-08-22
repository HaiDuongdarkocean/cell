// OcrSettingsPanel — T17-T20 + split dual-stream (Task 8).
// Manager Panel UI for OCR toggle + config: per-origin enable, target/native
// language (108-lang PaddleOCR catalog), split dual-stream, subtitle region %.
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
import {
  PADDLE_OCR_LANGUAGE_GROUPS,
  resolveOcrLang,
  type PaddleOcrLangEntry,
} from '@/features/ocr/engine/paddleOcrLanguages';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis';
import { formatPct, defaultBottomRegion } from '@/features/ocr/overlay/regionSelector';
import styles from './OcrSettingsPanel.module.css';

/** Auto-detect first, then the 108-language PaddleOCR catalog (alphabetical). */
const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect (system default)' },
  ...PADDLE_OCR_LANGUAGE_GROUPS
    .flatMap((g): PaddleOcrLangEntry[] => [...g.languages])
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((l) => ({ value: l.abbr, label: l.label })),
];

export interface OcrSettingsPanelProps {
  /** Current page URL — used to determine origin. */
  readonly url: string;
  /** System default for the target language dropdown (ISO/BCP-47). Default 'auto'. */
  readonly systemTargetLang?: string;
  /** System default for the native language dropdown (ISO/BCP-47). Default 'auto'. */
  readonly systemNativeLang?: string;
}

export function OcrSettingsPanel({
  url,
  systemTargetLang = 'auto',
  systemNativeLang = 'auto',
}: OcrSettingsPanelProps): ReactElement {
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

  // Shared patch → persist → refresh (pattern of handleRegionSliderChange).
  const patchOcrState = useCallback(async (patch: Partial<OcrOriginState>) => {
    if (!settings || !origin || !ocrState) return;
    const next = setOcrPreference(settings, origin, { ...ocrState, ...patch });
    await saveOcrSettings(next);
    setSettings(next);
    setOcrState(getOcrPreference(next, origin));
  }, [settings, origin, ocrState]);

  // 'auto' in the dropdown = clear override → fall back to system default.
  const handleLangOverrideChange = useCallback((key: 'targetLangOverride' | 'nativeLangOverride', value: string) => {
    void patchOcrState({ [key]: value === 'auto' ? null : value });
  }, [patchOcrState]);

  const handleLangReset = useCallback((key: 'targetLangOverride' | 'nativeLangOverride') => {
    void patchOcrState({ [key]: null });
  }, [patchOcrState]);

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
  const hasCustomRegion = ocrState?.customRegion != null;
  const targetLangOverride = ocrState?.targetLangOverride ?? null;
  const nativeLangOverride = ocrState?.nativeLangOverride ?? null;
  const splitEnabled = ocrState?.splitEnabled ?? DEFAULT_OCR_ORIGIN_STATE.splitEnabled;
  const splitRatio = ocrState?.splitRatio ?? DEFAULT_OCR_ORIGIN_STATE.splitRatio;
  const splitTopIsTarget = ocrState?.splitTopIsTarget ?? DEFAULT_OCR_ORIGIN_STATE.splitTopIsTarget;
  // jsdom/mobile Safari: deviceMemory is optional — default to 8 (no low-RAM hint).
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
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
        {/* Target language row — 108-lang select + reset-to-system-default */}
        <SettingsRow divider>
          <LabelGroup
            icon={<Icon name="languages" size="sm" />}
            label="Target language"
          />
          <div className={styles.langRow}>
            <Select
              value={resolveOcrLang(targetLangOverride, systemTargetLang)}
              options={LANGUAGE_OPTIONS}
              onChange={(v) => handleLangOverrideChange('targetLangOverride', v)}
              aria-label="OCR target language"
              data-cell-id="ocr-target-language"
              menuAlign="right"
              className={styles.langSelect}
            />
            {targetLangOverride != null && (
              <button
                type="button"
                className={styles.resetBtn}
                aria-label="Reset target language to system default"
                data-cell-id="ocr-target-lang-reset"
                onClick={() => handleLangReset('targetLangOverride')}
              >
                <Icon name="rotateCcw" size="sm" />
              </button>
            )}
          </div>
        </SettingsRow>

        {/* Native language row */}
        <SettingsRow divider>
          <LabelGroup
            icon={<Icon name="languages" size="sm" />}
            label="Native language"
          />
          <div className={styles.langRow}>
            <Select
              value={resolveOcrLang(nativeLangOverride, systemNativeLang)}
              options={LANGUAGE_OPTIONS}
              onChange={(v) => handleLangOverrideChange('nativeLangOverride', v)}
              aria-label="OCR native language"
              data-cell-id="ocr-native-language"
              menuAlign="right"
              className={styles.langSelect}
            />
            {nativeLangOverride != null && (
              <button
                type="button"
                className={styles.resetBtn}
                aria-label="Reset native language to system default"
                data-cell-id="ocr-native-lang-reset"
                onClick={() => handleLangReset('nativeLangOverride')}
              >
                <Icon name="rotateCcw" size="sm" />
              </button>
            )}
          </div>
        </SettingsRow>

        {/* ─── Split dual-stream section (spec ocr-split-dual-stream) ─── */}
        <SettingsRow divider>
          <LabelGroup
            icon={<Icon name="crop" size="sm" />}
            label="Split"
            hint="Split the capture region into two halves — one per language stream"
          />
          <Toggle
            checked={splitEnabled}
            onChange={(v) => void patchOcrState({ splitEnabled: v })}
            ariaLabel="Toggle split dual subtitles"
            dataTestId="ocr-split-toggle"
            size="sm"
          />
        </SettingsRow>
        {splitEnabled && (
          <>
            <SettingsRow stacked divider>
              <LabelGroup label="Top half" sublabel="Which language stream runs in the top half" />
              <div className={styles.segmentButtons}>
                <Button
                  variant="outline"
                  size="sm"
                  active={splitTopIsTarget}
                  onClick={() => void patchOcrState({ splitTopIsTarget: true })}
                  data-cell-id="ocr-split-top-target"
                >
                  Top = Target
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  active={!splitTopIsTarget}
                  onClick={() => void patchOcrState({ splitTopIsTarget: false })}
                  data-cell-id="ocr-split-top-native"
                >
                  Top = Native
                </Button>
              </div>
            </SettingsRow>
            <SliderRow
              icon={<Icon name="moveVertical" size="sm" />}
              label="Split ratio"
              hint="Height of the top half as % of the capture region"
              value={Math.round(splitRatio * 100)}
              min={10}
              max={90}
              step={1}
              onChange={(v) => void patchOcrState({ splitRatio: v / 100 })}
              aria-label="OCR split ratio"
              variant="end"
              divider
              formatValue={(v) => `${v}%`}
            />
            {deviceMemory < 4 && (
              <SettingsRow stacked divider>
                <p className={styles.sliderHint}>
                  Low memory mode: both halves use the target model
                </p>
              </SettingsRow>
            )}
          </>
        )}

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
