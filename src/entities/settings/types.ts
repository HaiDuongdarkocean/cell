// Settings types (entities/settings)

import type { VideoQuality } from '@/entities/video/types';
import type { OverlayStyleConfig } from '@/entities/subtitle/types';

// === Keyboard Shortcut Types (floating panel) ===

/** Actions mappable to keyboard shortcuts in the subtitle panel. */
export type ShortcutAction =
  | 'prev-cue'
  | 'next-cue'
  | 'replay-cue'
  | 'toggle-overlay'
  | 'toggle-panel'
  | 'toggle-translate';

/** A single keyboard shortcut binding: action ↔ key (with optional modifiers for combos). */
export interface KeyboardShortcut {
  readonly action: ShortcutAction;
  /** Lowercase single key, e.g. 'a', 'arrowleft'. For combo: the final key. */
  readonly key: string;
  /** Ctrl modifier (combo support, ADR-021 D7). Default false (backward compat). */
  readonly ctrl?: boolean;
  /** Shift modifier (combo support, ADR-021 D7). Default false (backward compat). */
  readonly shift?: boolean;
  /** Alt modifier (combo support, ADR-021 D7). Default false (backward compat). */
  readonly alt?: boolean;
}

// === Nav Cluster Types (ADR-018) ===

/** Nav cluster button size in px (free range 10-100, ADR-018 D2-rev). */
export type NavClusterButtonSize = number;

/** Settings slice for nav cluster (flat keys in Settings, ADR-018 D2, ADR-025). */
export interface NavClusterSettings {
  readonly enabled: boolean;
  readonly buttonSize: NavClusterButtonSize;
  readonly buttonOpacity: number; // 0-1
}

/** Unified subtitle block settings (ADR-025). */
export interface SubtitleBlockSettings {
  readonly yOffsetPercent: number; // 0-95, top edge of block
  readonly globalScale: number; // 0.5-2
  readonly bgOpacity: number; // 0-1
}

// === Card Creator (Anki integration) — schema v10 ===

/** How media fields are merged when updating an existing note. */
export type MediaUpdateMode = 'overwrite' | 'append' | 'skip';

/** Settings slice for Card Creator (AnkiConnect integration). */
export interface CardCreatorSettings {
  /** AnkiConnect base URL. Default `http://localhost:8765`. Mobile may use LAN IP. */
  readonly ankiConnectUrl: string;
  /** Last-used deck name (preselected in dialog). Default 'Default'. */
  readonly defaultDeck: string;
  /** Last-used note type (preselected in dialog). Default 'Cell Video Card'. */
  readonly defaultNoteType: string;
  /** Default tags string (space-separated, Anki convention). Default '' (empty — user enters tags manually). */
  readonly defaultTags: string;
  /** How media fields merge when updating an existing note. Default 'overwrite'. */
  readonly mediaUpdateMode: MediaUpdateMode;
}

// === Settings Types ===

/** Conversion behavior for M3U8 downloads. */
export type ConvertToMp4Mode = 'always' | 'small-only' | 'never';

/**
 * Parallel conversion scaling mode for TS→MP4 transmuxing.
 *
 * - `'auto'`   — runtime decides worker count based on file size, CPU cores,
 *                 and safety analysis. Default.
 * - `'manual'` — user specifies a worker count; runtime still clamps to safe
 *                 bounds and may fallback to sequential if input is ineligible.
 * - `'off'`    — always use the current sequential transmuxer.
 */
export type ParallelConversionMode = 'auto' | 'manual' | 'off';

/**
 * Fallback strategy when parallel conversion fails.
 *
 * - `'sequential'` — retry the entire conversion sequentially.
 * - `'save-ts'`    — skip conversion, save the `.ts` file directly.
 */
export type ParallelFallbackMode = 'sequential' | 'retry-reduced' | 'save-ts' | 'fail';

/**
 * Source for naming downloaded files (video + subtitle).
 *
 * - `'title-fallback'` — Use the detected media title; if it is empty or
 *   generic ("video", "untitled", etc.), fall back to a beautified base
 *   name extracted from the URL. Default.
 * - `'title-only'`     — Always use the detected title; if empty/generic,
 *   use "untitled" as the base name.
 * - `'url-only'`       — Always use a beautified base name extracted from
 *   the URL path, ignoring the detected title entirely.
 */
export type FilenameSource = 'title-fallback' | 'title-only' | 'url-only';

export interface Settings {
  /** Schema version for migration (ADR-017 D8). Current: 1. */
  readonly schemaVersion?: number;
  readonly concurrentDownloads: number;
  readonly defaultQuality: VideoQuality;
  /** @deprecated Use `selectedSubtitleLanguages` instead. Migrated on load. */
  readonly defaultSubtitleLanguage?: string;
  /** Multi-select subtitle languages (ISO 639-1 codes). `['all']` = any. */
  readonly selectedSubtitleLanguages: string[];
  /** When to attempt TS→MP4 conversion during M3U8 downloads. */
  readonly convertToMp4: ConvertToMp4Mode;
  /**
   * Parallel conversion scaling mode. Controls whether the offscreen
   * document attempts parallel segment-group transmuxing or uses the
   * sequential path. Default: `'auto'` (but auto only does dry-run
   * planning until experimental parallel is proven safe).
   */
  readonly parallelConversion: ParallelConversionMode;
  /**
   * User-requested worker count for manual mode. Clamped at runtime to
   * `[MIN_PARALLEL_WORKERS, MAX_PARALLEL_WORKERS]`. Default: 4.
   */
  readonly manualWorkerCount: number;
  /**
   * Fallback strategy when parallel conversion fails after partial work.
   * Default: `'save-ts'` for large files to avoid wasting time.
   */
  readonly parallelFallback: ParallelFallbackMode;
  /**
   * Number of M3U8 segments to fetch in parallel during a single download.
   * Higher values utilize network bandwidth better but risk server
   * throttling (403/429). Clamped to `[MIN_SEGMENT_CONCURRENCY,
   * MAX_SEGMENT_CONCURRENCY]`. Default: 6.
   */
  readonly segmentConcurrency: number;
  /**
   * Source for naming downloaded files. Default: `'title-fallback'`.
   */
  readonly filenameSource: FilenameSource;
  /** Preferred video format for auto-select. Fallback to other format if unavailable. */
  readonly preferredVideoFormat: 'mp4' | 'm3u8';
  /** When true, popup auto-selects media matching preferences on open. */
  readonly autoSelectEnabled: boolean;
  /** Target language for subtitle overlay (ISO 639-1 code, e.g. 'en'). Default 'en' (V4). */
  readonly subtitleOverlayTargetLanguage: string;
  /** Native language for bilingual subtitle overlay (ISO 639-1 code, e.g. 'vi'). Default 'vi' (V4). */
  readonly subtitleOverlayNativeLanguage: string;
  /** When true, subtitle overlay auto-loads from extension-detected subtitles matching target language. Default true (V4). */
  readonly subtitleOverlayAutoLoad: boolean;
  /**
   * When true, YouTube auto-generated captions (ASR, kind="asr") are eligible
   * for auto-load. When false, ASR tracks are filtered out — only manual
   * captions auto-load. Default false (V6) — anh yêu muốn tắt ASR mặc định,
   * bật thủ công khi cần. Applies to both target + native sides.
   */
  readonly subtitleOverlayAutoLoadAsr: boolean;
  /**
   * When true, if site has no native subtitle track → auto-translate target→native
   * via Google Translate unofficial endpoint (ADR-021). Background sequential prefill,
   * 0 setting params (chunk size, gap, budget hardcode). Default true (auto-dịch khi
   * native thiếu — kim chỉ nam "user vào và học thôi"). Cache per-session in-memory,
   * clear on SPA nav.
   */
  readonly subtitleOverlayAutoTranslate: boolean;
  /** Per-layer appearance config for target subtitle overlay (ADR-013, ADR-025). Independent from native. */
  readonly subtitleOverlayTargetStyle?: OverlayStyleConfig;
  /** Per-layer appearance config for native subtitle overlay (ADR-013, ADR-025). Independent from target. */
  readonly subtitleOverlayNativeStyle?: OverlayStyleConfig;
  /**
   * Per-site subtitle preference (ADR-014 D5). Key = origin (e.g. 'themoviebox.org'),
   * value = { [lang]: subIndex } where subIndex is 0-based index into filtered
   * matches. Fallback first-match when index out of range (B8).
   */
  readonly subtitlePreference?: Record<string, Record<string, number>>;
  /**
   * Per-URL subtitle time offset in ms (ADR-019). Key = window.location.href (full URL),
   * value = offsetMs. +offset = sub muộn hơn, -offset = sub sớm hơn.
   * Persist khi auto-commit (2 phút không action). Reset khi load sub file mới.
   */
  readonly subtitleOffset?: Record<string, number>;
  /** Keyboard shortcuts for subtitle floating panel. Default: a/d/s/w/t. */
  readonly keyboardShortcuts: KeyboardShortcut[];
  // === Nav Cluster (ADR-018, ADR-025) — flat keys, schema v3 ===
  /** Nav cluster master toggle. Default: true. */
  readonly navClusterEnabled: boolean;
  /** Nav cluster button size preset. Default: 48 (medium). */
  readonly navClusterButtonSize: NavClusterButtonSize;
  /** Nav cluster button opacity (0-1). Default: 0.9. */
  readonly navClusterButtonOpacity: number;
  // === Subtitle Block (ADR-025) ===
  /** Unified block settings (yOffset, globalScale, bgOpacity). Default: { yOffsetPercent: 75, globalScale: 1, bgOpacity: 0.7 }. */
  readonly subtitleBlockSettings: SubtitleBlockSettings;
  // === Card Creator (Anki integration) — schema v10 ===
  /** Card Creator settings (AnkiConnect URL, defaults, media update mode). */
  readonly cardCreator: CardCreatorSettings;
}
