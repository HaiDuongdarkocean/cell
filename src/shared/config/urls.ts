import type { VideoFormat, SubtitleFormat } from '@/types/media';

// === Test Sites ===

export const TEST_SITES = {
  hoathinh3d: 'https://hoathinh3d.co/xem-phim-vinh-sinh/tap-1-sv1.html',
  kisskh: 'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816',
} as const;

// === Supported Formats ===

export const SUPPORTED_VIDEO_FORMATS: readonly VideoFormat[] = [
  'm3u8',
  'mp4',
  'ts',
  'webm',
];

export const SUPPORTED_SUBTITLE_FORMATS: readonly SubtitleFormat[] = [
  'ass',
  'vtt',
  'srt',
];

// === URL Patterns for Network Interception ===

export const VIDEO_URL_PATTERNS: readonly RegExp[] = [
  /\.m3u8(\?|$)/i,
  /\.ts(\?|$)/i,
  /\.mp4(\?|$)/i,
  /\.webm(\?|$)/i,
];

export const SUBTITLE_URL_PATTERNS: readonly RegExp[] = [
  /\.ass(\?|$)/i,
  /\.vtt(\?|$)/i,
  /\.srt(\?|$)/i,
  // Match subtitle URLs with common query parameters
  /[\?&](format|type|subtype)=(vtt|srt|ass)(?:&|$)/i,
  // Match common subtitle path patterns
  /\/(subtitles|subs|caption|cc)\//i,
];

// === File Extensions ===

export const VIDEO_EXTENSIONS = {
  m3u8: '.m3u8',
  mp4: '.mp4',
  ts: '.ts',
  webm: '.webm',
} as const;

export const SUBTITLE_EXTENSIONS = {
  ass: '.ass',
  vtt: '.vtt',
  srt: '.srt',
} as const;
