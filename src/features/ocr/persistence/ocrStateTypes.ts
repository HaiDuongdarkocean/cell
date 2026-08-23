// OcrOriginState — per-origin OCR preference (spec §AD4).
// Reuses tokenizeSettingsStore pattern: Record<origin, state> in chrome.storage.local.

import type { OcrLanguageMode } from '../engine/types';

/** Custom region in % of video dimensions. null = default bottom mode. */
export interface CustomRegion {
  /** Left offset as % of video width (0-100). */
  readonly xPct: number;
  /** Top offset as % of video height (0-100). */
  readonly yPct: number;
  /** Width as % of video width (1-100). */
  readonly widthPct: number;
  /** Height as % of video height (1-100). */
  readonly heightPct: number;
}

/** Per-origin OCR state. Persisted in chrome.storage.local. */
export interface OcrOriginState {
  /** Whether OCR is enabled for this origin. */
  readonly ocrEnabled: boolean;
  /** Language mode hint for the OCR engine. */
  readonly languageMode: OcrLanguageMode;
  /** Subtitle region height as % of video height (default 15). Used in default bottom mode. */
  readonly subtitleRegionPct: number;
  /** Subtitle region width as % of video width, centered (default 100). Used in default bottom mode. */
  readonly subtitleRegionWidthPct: number;
  /** Custom region (x, y, width, height in %). null = use default bottom mode. */
  readonly customRegion: CustomRegion | null;
  // === Split dual-stream (spec ocr-split-dual-stream) ===
  /** Split enabled — chia đôi region thành top + bottom. Default false. */
  readonly splitEnabled: boolean;
  /** Split ratio — tỷ lệ top/total (0.1-0.9). Default 0.5. */
  readonly splitRatio: number;
  /** Top = target language? Default true. */
  readonly splitTopIsTarget: boolean;
  /** Target language override (PaddleOCR abbr). null = system default. */
  readonly targetLangOverride: string | null;
  /** Native language override. null = system default. */
  readonly nativeLangOverride: string | null;
}

/** Default OCR state for a newly-enabled origin. */
export const DEFAULT_OCR_ORIGIN_STATE: OcrOriginState = {
  ocrEnabled: true,
  languageMode: 'auto',
  subtitleRegionPct: 15,
  subtitleRegionWidthPct: 100,
  customRegion: null,
  splitEnabled: false,
  splitRatio: 0.5,
  splitTopIsTarget: true,
  targetLangOverride: null,
  nativeLangOverride: null,
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
