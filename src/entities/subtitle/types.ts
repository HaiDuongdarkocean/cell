// Type definitions for subtitle overlay functionality
// Reuses SrtCue from media.ts — SubtitleLine was a duplicate, deleted per ponytail rule.

import type { SrtCue, BilingualCue } from '@/entities/media/types';

// === Subtitle Format Types ===

export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa' | 'unknown';

// === Subtitle State Types ===

/**
 * Runtime state for subtitle overlay sync.
 * Uses SrtCue[] (reused from media.ts) — same shape as SubtitleLine was.
 */
export interface SubtitleState {
  readonly cues: SrtCue[]; // All parsed subtitle cues
  readonly currentIndex: number; // Currently displayed cue index (-1 if none)
  readonly videoElement: HTMLVideoElement; // Reference to video element
  readonly overlayElement: HTMLElement; // Reference to overlay DOM element
  readonly format: SubtitleFormat; // Source format (for conversion logic)
}

// === Overlay Configuration Types ===

/**
 * Configuration for subtitle overlay behavior (language, auto-load).
 * Kept separate from `OverlayStyleConfig` (per-layer appearance) per ADR-013 D2.
 */
export interface OverlayConfig {
  readonly targetLanguage: string; // Target language ISO 639-1 code (e.g., 'en', 'vi')
  readonly autoLoadEnabled: boolean; // Whether auto-load from extension detect
  readonly fontSize: number; // Font size in pixels (default: 24) — legacy, superseded by OverlayStyleConfig
  readonly position: 'bottom' | 'top' | 'center'; // Vertical position — legacy, superseded by OverlayStyleConfig.yOffsetPercent
  readonly backgroundColor: string; // Background color (rgba format) — legacy, superseded by OverlayStyleConfig
  readonly textColor: string; // Text color (hex or rgba) — legacy, superseded by OverlayStyleConfig
  readonly showTimestamps: boolean; // Whether to display timestamps
}

/**
 * Text shadow configuration for overlay (ADR-013 D2).
 * 3 preset (none/soft/cinema) + custom (4 field).
 */
export interface TextShadowConfig {
  readonly preset: 'none' | 'soft' | 'cinema' | 'custom';
  readonly color: string; // hex, default '#000000'
  readonly blur: number; // px, default 2
  readonly offsetX: number; // px, default 1
  readonly offsetY: number; // px, default 1
}

/**
 * Per-layer appearance configuration for subtitle overlay (ADR-013 D2).
 * Replaces the appearance fields of `OverlayConfig` (fontSize, position, colors).
 * `OverlayConfig` kept for behavior (targetLanguage, autoLoadEnabled, showTimestamps).
 *
 * One config per layer: target + native are independent (2 overlay div, 2 style).
 */
export interface OverlayStyleConfig {
  readonly fontSize: number; // px, default 24 (target) / 20 (native)
  readonly textColor: string; // hex, default '#ffffff'
  readonly backgroundColor: string; // hex (alpha tách rời — color picker native không hỗ trợ alpha)
  readonly backgroundOpacity: number; // 0-1, default 0.7
  readonly textOpacity: number; // 0-1, default 1
  readonly textShadow: TextShadowConfig;
  readonly fontFamily: string; // CSS font-family string, default 'sans-serif'
  readonly yOffsetPercent: number; // 0-95, % video height, default 10 (target bottom) / 5 (native top)
  readonly horizontalAlign: 'left' | 'center' | 'right'; // default 'center'
  readonly visible: boolean; // on/off, default true (native toggle C1)
}

// === Parser Types ===

/**
 * Result of subtitle parsing operation.
 */
export interface ParseResult {
  readonly success: boolean;
  readonly cues: SrtCue[]; // Reused SrtCue from media.ts
  readonly format: SubtitleFormat;
  readonly error?: string;
}

// === Sync Types ===

/**
 * Sync status for subtitle overlay.
 */
export interface SyncStatus {
  readonly isSyncing: boolean; // Whether sync is active
  readonly currentTime: number; // Current video time in milliseconds
  readonly displayedCue: SrtCue | null; // Currently displayed cue
}

// === Bilingual Parser Types ===

/**
 * Result of bilingual SRT parsing operation.
 * Mirrors ParseResult shape but with BilingualCue[].
 */
export interface BilingualParseResult {
  readonly success: boolean;
  readonly cues: BilingualCue[];
  readonly error?: string;
}
