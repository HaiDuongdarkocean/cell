// Video + HLS/M3U8 playlist types (entities/video)

export type VideoFormat = 'm3u8' | 'mp4' | 'ts' | 'webm' | 'unknown';

export type VideoQuality = 'highest' | '1080p' | '720p' | '480p' | '360p' | 'lowest' | 'auto';

export interface VideoVariant {
  readonly url: string;
  readonly quality: VideoQuality;
  readonly resolution?: string;
  readonly bandwidth?: number;
  readonly playlistUrl?: string;
  readonly size?: number; // File size in bytes
}

export interface DetectedVideo {
  readonly id: string;
  readonly url: string;
  readonly format: VideoFormat;
  readonly title: string;
  readonly tabId: number;
  readonly tabUrl: string;
  readonly detectedAt: number;
  readonly variants: VideoVariant[];
  readonly selectedVariantId?: string;
}

// === M3U8 Playlist Types ===

/**
 * Byte range specification for `#EXT-X-BYTERANGE`.
 * `offset` is optional — when absent, it equals the byte after the
 * previous segment in the same media file (per RFC 8216 §4.3.2.2).
 */
export interface ByteRange {
  readonly length: number;
  readonly offset?: number;
}

/**
 * Encryption metadata parsed from `#EXT-X-KEY`.
 * Only `AES-128` is supported for decryption; other methods (SAMPLE-AES,
 * Widevine, etc.) are parsed but not decrypted.
 */
export interface HlsEncryption {
  readonly method: string;
  readonly keyUri: string;
  readonly iv?: string;
}

/**
 * Init segment metadata parsed from `#EXT-X-MAP` (fMP4 / CMAF).
 * The init segment must be fetched and prepended to the .m4s segments
 * to produce a valid fragmented MP4 file.
 */
export interface HlsInitSegment {
  readonly uri: string;
  readonly byteRange?: ByteRange;
}

export interface TsSegment {
  readonly url: string;
  readonly duration: number;
  readonly sequence?: number;
  /** Byte range for `#EXT-X-BYTERANGE` segments. */
  readonly byteRange?: ByteRange;
  /** `true` if preceded by `#EXT-X-DISCONTINUITY` (ad break / codec change). */
  readonly discontinuity?: boolean;
}

/**
 * Byte range metadata for a single HLS segment after it has been appended
 * to `input.ts` in OPFS. Used by the parallel conversion engine to split
 * the merged file at safe segment boundaries.
 */
export interface SegmentRange {
  /** Zero-based index in the original playlist order. */
  readonly index: number;
  /** Byte offset where this segment starts in `input.ts`. */
  readonly startByte: number;
  /** Byte offset where this segment ends (exclusive) in `input.ts`. */
  readonly endByte: number;
  /** Size of this segment in bytes (`endByte - startByte`). */
  readonly size: number;
  /** Segment duration in seconds from `#EXTINF`, if available. */
  readonly duration?: number;
}

export interface M3u8Playlist {
  readonly version: number;
  readonly targetDuration: number;
  readonly segments: TsSegment[];
  readonly isMasterPlaylist: boolean;
  readonly variants: M3u8Variant[];
  /** Encryption info from `#EXT-X-KEY` (undefined if no encryption). */
  readonly encryption?: HlsEncryption;
  /** Init segment for fMP4/CMAF from `#EXT-X-MAP` (undefined for plain .ts). */
  readonly initSegment?: HlsInitSegment;
  /** `true` if `#EXT-X-ENDLIST` present (VOD). `false` for LIVE streams. */
  readonly hasEndlist?: boolean;
}

export interface M3u8Variant {
  readonly url: string;
  readonly bandwidth: number;
  readonly resolution?: string;
  readonly codecs?: string;
  readonly quality: VideoQuality;
}
