export * from './types';

// Re-export video + settings types so @/entities/media is a single import
// surface for media-adjacent types (Strangler Fig completion — the former
// @/types/* shims were deleted 2026-09-16).
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

export type {
  ShortcutAction,
  KeyboardShortcut,
  ConvertToMp4Mode,
  ParallelConversionMode,
  ParallelFallbackMode,
  FilenameSource,
  Settings,
  NavClusterButtonSize,
  NavClusterSettings,
  SubtitleBlockSettings,
  CardCreatorSettings,
  MediaUpdateMode,
} from '@/entities/settings/types';
