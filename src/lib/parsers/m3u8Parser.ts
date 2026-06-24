import type {
  ByteRange,
  HlsEncryption,
  HlsInitSegment,
  M3u8Playlist,
  M3u8Variant,
  TsSegment,
  VideoQuality,
} from '@/types/media';

/**
 * Parses HLS m3u8 playlist content into a structured M3u8Playlist object.
 *
 * Handles both master playlists (multiple quality variants via #EXT-X-STREAM-INF)
 * and media playlists (segments via #EXTINF + segment URLs).
 *
 * @param content - Raw m3u8 playlist text content.
 * @param baseUrl - Optional base URL to resolve relative segment/variant URLs against.
 * @throws {Error} If content is empty or whitespace-only.
 */
export function parseM3u8(content: string, baseUrl?: string): M3u8Playlist {
  if (content.trim().length === 0) {
    throw new Error('m3u8 content is empty');
  }

  const lines = content.split(/\r?\n/);

  let version = 3;
  let targetDuration = 0;
  let isMasterPlaylist = false;
  const segments: TsSegment[] = [];
  const variants: M3u8Variant[] = [];
  let encryption: HlsEncryption | undefined;
  let initSegment: HlsInitSegment | undefined;
  let hasEndlist = false;

  let pendingExtinfDuration: number | null = null;
  let pendingStreamInfAttrs: Record<string, string> | null = null;
  let pendingByteRange: ByteRange | null = null;
  let pendingDiscontinuity = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    if (line.startsWith('#')) {
      if (line.startsWith('#EXT-X-VERSION:')) {
        const value = line.slice('#EXT-X-VERSION:'.length).trim();
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          version = parsed;
        }
        continue;
      }

      if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        const value = line.slice('#EXT-X-TARGETDURATION:'.length).trim();
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          targetDuration = parsed;
        }
        continue;
      }

      if (line.startsWith('#EXTINF:')) {
        const rest = line.slice('#EXTINF:'.length);
        const commaIndex = rest.indexOf(',');
        const durationStr =
          commaIndex >= 0 ? rest.slice(0, commaIndex) : rest;
        const parsed = Number.parseFloat(durationStr.trim());
        pendingExtinfDuration = Number.isNaN(parsed) ? 0 : parsed;
        continue;
      }

      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        isMasterPlaylist = true;
        const attrs = line.slice('#EXT-X-STREAM-INF:'.length);
        pendingStreamInfAttrs = parseAttributes(attrs);
        continue;
      }

      if (line.startsWith('#EXT-X-KEY:')) {
        const attrs = parseAttributes(line.slice('#EXT-X-KEY:'.length));
        const method = attrs['METHOD'] ?? 'NONE';
        const keyUri = attrs['URI'] ? resolveUrl(attrs['URI'], baseUrl) : '';
        const iv = attrs['IV'];
        if (method === 'NONE') {
          encryption = undefined;
        } else {
          encryption = { method, keyUri, iv };
        }
        continue;
      }

      if (line.startsWith('#EXT-X-MAP:')) {
        const attrs = parseAttributes(line.slice('#EXT-X-MAP:'.length));
        const uri = attrs['URI'] ? resolveUrl(attrs['URI'], baseUrl) : '';
        const byteRangeStr = attrs['BYTERANGE'];
        let mapByteRange: ByteRange | undefined;
        if (byteRangeStr) {
          mapByteRange = parseByteRange(byteRangeStr);
        }
        initSegment = { uri, byteRange: mapByteRange };
        continue;
      }

      if (line.startsWith('#EXT-X-BYTERANGE:')) {
        const value = line.slice('#EXT-X-BYTERANGE:'.length).trim();
        pendingByteRange = parseByteRange(value);
        continue;
      }

      if (line.startsWith('#EXT-X-DISCONTINUITY')) {
        pendingDiscontinuity = true;
        continue;
      }

      if (line.startsWith('#EXT-X-ENDLIST')) {
        hasEndlist = true;
        continue;
      }

      // Unknown / other tags: skip gracefully
      continue;
    }

    // Non-comment, non-empty line: a URL (segment or variant playlist)
    const resolvedUrl = resolveUrl(line, baseUrl);

    if (pendingStreamInfAttrs !== null) {
      const attrs = pendingStreamInfAttrs;
      const bandwidth = Number.parseInt(attrs['BANDWIDTH'] ?? '0', 10);
      const resolution = attrs['RESOLUTION'];
      const codecs = attrs['CODECS'];
      variants.push({
        url: resolvedUrl,
        bandwidth: Number.isNaN(bandwidth) ? 0 : bandwidth,
        resolution,
        codecs,
        quality: 'auto',
      });
      pendingStreamInfAttrs = null;
      continue;
    }

    if (pendingExtinfDuration !== null) {
      segments.push({
        url: resolvedUrl,
        duration: pendingExtinfDuration,
        byteRange: pendingByteRange ?? undefined,
        discontinuity: pendingDiscontinuity || undefined,
      });
      pendingExtinfDuration = null;
      pendingByteRange = null;
      pendingDiscontinuity = false;
      continue;
    }

    // A URL line without a preceding #EXTINF or #EXT-X-STREAM-INF: skip.
  }

  if (isMasterPlaylist) {
    assignVariantQualities(variants);
  }

  return {
    version,
    targetDuration,
    segments,
    isMasterPlaylist,
    variants,
    encryption,
    initSegment,
    hasEndlist,
  };
}

/**
 * Parses a byte-range string (e.g. "1000000@500000" or "1000000") into a
 * ByteRange object. The offset is optional — when absent, it equals the
 * byte after the previous segment in the same media file.
 */
function parseByteRange(value: string): ByteRange {
  const atIdx = value.indexOf('@');
  if (atIdx >= 0) {
    const length = Number.parseInt(value.slice(0, atIdx).trim(), 10);
    const offset = Number.parseInt(value.slice(atIdx + 1).trim(), 10);
    return { length: Number.isNaN(length) ? 0 : length, offset: Number.isNaN(offset) ? undefined : offset };
  }
  const length = Number.parseInt(value.trim(), 10);
  return { length: Number.isNaN(length) ? 0 : length };
}

/**
 * Parses an HLS attribute string (e.g. `BANDWIDTH=5000,RESOLUTION=1920x1080,CODECS="a,b"`)
 * into a key-value record, respecting quoted values that may contain commas.
 */
function parseAttributes(attrs: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  const len = attrs.length;

  while (i < len) {
    // skip whitespace and leading commas
    while (i < len && (attrs[i] === ' ' || attrs[i] === ',')) {
      i++;
    }
    if (i >= len) break;

    // read key until '='
    let key = '';
    while (i < len && attrs[i] !== '=') {
      key += attrs[i];
      i++;
    }
    if (i >= len) break;
    i++; // skip '='

    let value = '';
    if (i < len && attrs[i] === '"') {
      // quoted value
      i++; // skip opening quote
      while (i < len && attrs[i] !== '"') {
        value += attrs[i];
        i++;
      }
      if (i < len) i++; // skip closing quote
    } else {
      // unquoted value until ','
      while (i < len && attrs[i] !== ',') {
        value += attrs[i];
        i++;
      }
    }

    result[key.trim()] = value.trim();
  }

  return result;
}

/**
 * Maps a resolution string (e.g. "1920x1080") to a VideoQuality label.
 */
function resolutionToQuality(resolution: string | undefined): VideoQuality {
  if (!resolution) return 'auto';
  const match = resolution.match(/^(\d+)x(\d+)$/);
  if (!match) return 'auto';
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);

  if (width === 1920 && height === 1080) return '1080p';
  if (width === 1280 && height === 720) return '720p';
  if (width === 854 && height === 480) return '480p';
  if (width === 640 && height === 360) return '360p';

  return 'auto';
}

/**
 * Assigns quality labels to variants in a master playlist.
 * The first variant is marked 'highest', the last 'lowest', and the rest
 * are mapped from their resolution (falling back to 'auto').
 */
function assignVariantQualities(variants: M3u8Variant[]): void {
  if (variants.length === 0) return;

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    let quality: VideoQuality;

    if (i === 0) {
      quality = 'highest';
    } else if (i === variants.length - 1) {
      quality = 'lowest';
    } else {
      quality = resolutionToQuality(variant.resolution);
    }

    variants[i] = { ...variant, quality };
  }
}

/**
 * Resolves a possibly-relative URL against a base URL.
 * Absolute URLs (http/https) are returned unchanged.
 *
 * **Query param carry-over:** If the resolved URL has no query params but
 * the base URL does, the base URL's query params are appended. This is
 * critical for signed HLS URLs (e.g. streamfree.vip) where auth tokens
 * live in the master playlist's query string and must be present on all
 * segment/variant requests.
 */
function resolveUrl(url: string, baseUrl?: string): string {
  if (!baseUrl) return url;
  try {
    const resolved = new URL(url, baseUrl);
    // Carry over query params from base URL if resolved URL has none.
    if (!resolved.search && baseUrl.includes('?')) {
      const baseQuery = baseUrl.slice(baseUrl.indexOf('?') + 1);
      if (baseQuery) {
        resolved.search = baseQuery;
      }
    }
    return resolved.href;
  } catch {
    return url;
  }
}
