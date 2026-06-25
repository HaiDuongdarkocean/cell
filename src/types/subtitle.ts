// Type definitions for subtitle overlay functionality
// Reuses SrtCue from media.ts — SubtitleLine was a duplicate, deleted per ponytail rule.

import type { SrtCue } from './media';

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
 * Configuration for subtitle overlay behavior.
 */
export interface OverlayConfig {
  readonly targetLanguage: string; // Target language ISO 639-1 code (e.g., 'en', 'vi')
  readonly autoLoadEnabled: boolean; // Whether auto-load from extension detect
  readonly fontSize: number; // Font size in pixels (default: 24)
  readonly position: 'bottom' | 'top' | 'center'; // Vertical position
  readonly backgroundColor: string; // Background color (rgba format)
  readonly textColor: string; // Text color (hex or rgba)
  readonly showTimestamps: boolean; // Whether to display timestamps
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
