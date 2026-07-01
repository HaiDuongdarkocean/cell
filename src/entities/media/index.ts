export * from './types';

// Re-export video + settings types so @/entities/media is a drop-in
// replacement for the former @/types/media barrel (Strangler Fig completion).
// Callers importing video/settings types via @/types/media now resolve here.
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
} from '@/entities/settings/types';
