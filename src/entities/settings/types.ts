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
  | 'toggle-panel';

/** A single keyboard shortcut binding: action ↔ key. */
export interface KeyboardShortcut {
  readonly action: ShortcutAction;
  readonly key: string; // single lowercase letter, e.g. 'a'
}

// === Nav Cluster Types (ADR-018) ===

/** Cluster position as percent of video container (0-100). Default {x:0, y:75}. */
export interface NavClusterPosition {
  readonly x: number;
  readonly y: number;
}

/** Nav cluster button size in px (free range 10-100, ADR-018 D2-rev). */
export type NavClusterButtonSize = number;

/** Settings slice for nav cluster (flat keys in Settings, ADR-018 D2). */
export interface NavClusterSettings {
  readonly enabled: boolean;
  readonly position: NavClusterPosition;
  readonly buttonSize: NavClusterButtonSize;
  readonly bgOpacity: number; // 0-1
  readonly buttonOpacity: number; // 0-1
  readonly collapsed: boolean;
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
  readonly theme: 'light' | 'dark';
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
  /** Per-layer appearance config for target subtitle overlay (ADR-013). Independent from native. */
  readonly subtitleOverlayTargetStyle?: OverlayStyleConfig;
  /** Per-layer appearance config for native subtitle overlay (ADR-013). Independent from target. */
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
  // === Nav Cluster (ADR-018) — flat keys, schema v2 ===
  /** Nav cluster master toggle. Default: true. */
  readonly navClusterEnabled: boolean;
  /** Nav cluster position as percent of video container. Default: { x: 0, y: 75 }. */
  readonly navClusterPosition: NavClusterPosition;
  /** Nav cluster button size preset. Default: 48 (medium). */
  readonly navClusterButtonSize: NavClusterButtonSize;
  /** Nav cluster background opacity (0-1). Default: 0.7. */
  readonly navClusterBgOpacity: number;
  /** Nav cluster button opacity (0-1). Default: 0.9. */
  readonly navClusterButtonOpacity: number;
  /** Nav cluster collapsed state (half-circle edge-stuck). Default: false. */
  readonly navClusterCollapsed: boolean;
}
