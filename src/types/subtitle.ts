// Type definitions for subtitle overlay functionality

// === Subtitle Format Types ===

export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa' | 'unknown';

// === Subtitle Line Types ===

/**
 * Single subtitle line with timing and text content.
 * Timestamps are in milliseconds for easier comparison with video.currentTime.
 */
export interface SubtitleLine {
  readonly index: number; // Line number (1-based from source file)
  readonly start: number; // Start time in milliseconds
  readonly end: number; // End time in milliseconds
  readonly text: string; // Subtitle text content
}

// === Subtitle State Types ===

/**
 * Runtime state for subtitle overlay sync.
 * Tracks current video, parsed lines, and sync status.
 */
export interface SubtitleState {
  readonly lines: SubtitleLine[]; // All parsed subtitle lines
  readonly currentIndex: number; // Currently displayed line index (-1 if none)
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
  readonly lines: SubtitleLine[];
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
  readonly displayedLine: SubtitleLine | null; // Currently displayed line
}