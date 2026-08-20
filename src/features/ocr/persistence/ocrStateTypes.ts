// OcrOriginState — per-origin OCR preference (spec §AD4).
// Reuses tokenizeSettingsStore pattern: Record<origin, state> in chrome.storage.local.

/** Per-origin OCR state. Persisted in chrome.storage.local. */
export interface OcrOriginState {
  /** Whether OCR is enabled for this origin. */
  readonly ocrEnabled: boolean;
  /** Language mode hint for the OCR engine. */
  readonly languageMode: 'auto' | 'zh' | 'en' | 'ja';
  /** Subtitle region height as % of video height (default 15). */
  readonly subtitleRegionPct: number;
}

/** Default OCR state for a newly-enabled origin. */
export const DEFAULT_OCR_ORIGIN_STATE: OcrOriginState = {
  ocrEnabled: true,
  languageMode: 'auto',
  subtitleRegionPct: 15,
};

/** OCR settings stored in chrome.storage.local — map origin → state. */
export interface OcrSettings {
  readonly schemaVersion: number;
  readonly origins: Readonly<Record<string, OcrOriginState>>;
}

export const OCR_SETTINGS_SCHEMA_VERSION = 1;

export const DEFAULT_OCR_SETTINGS: OcrSettings = {
  schemaVersion: OCR_SETTINGS_SCHEMA_VERSION,
  origins: {},
};
