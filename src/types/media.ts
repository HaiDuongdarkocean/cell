/**
 * Media types — barrel re-export from entities/ (Strangler Fig migration).
 *
 * The original god-file has been split into 3 domain entity modules:
 * - entities/video/   — video + HLS/M3U8 playlist types
 * - entities/settings/ — settings + keyboard shortcut types
 * - entities/media/    — download + subtitle format + parsed subtitle +
 *                        bilingual + auto-select + whitelist + network
 *
 * This barrel preserves the existing `@/types/media` import path so callers
 * don't need to change imports yet. New code SHOULD import from the specific
 * entity barrel (e.g. `@/entities/video`).
 *
 * NOTE: `SubtitleFormat` here ('ass'|'vtt'|'srt') differs from
 * `@/types/subtitle` SubtitleFormat (adds 'ssa'|'unknown'). Do NOT
 * consolidate yet — deferred to subtitle feature (M7) decision.
 */

// Video + HLS/M3U8
export type {
  VideoFormat,
  VideoQuality,
  VideoVariant,
  DetectedVideo,
  ByteRange,
  HlsEncryption,
  HlsInitSegment,
  TsSegment,
  SegmentRange,
  M3u8Playlist,
  M3u8Variant,
} from '@/entities/video/types';

// Settings + keyboard shortcuts
export type {
  ShortcutAction,
  KeyboardShortcut,
  ConvertToMp4Mode,
  ParallelConversionMode,
  ParallelFallbackMode,
  FilenameSource,
  Settings,
} from '@/entities/settings/types';

// Download + subtitle format + parsed subtitles + bilingual + auto-select + whitelist + network
export type {
  SubtitleFormat,
  DetectedSubtitle,
  AssStyle,
  AssDialogue,
  AssSubtitle,
  VttCue,
  VttSubtitle,
  SrtCue,
  SrtSubtitle,
  BilingualCue,
  DownloadStatus,
  MediaType,
  DownloadItem,
  ConversionPhase,
  DownloadProgress,
  AutoSelectResult,
  WhitelistEntry,
  NetworkRequest,
} from '@/entities/media/types';
