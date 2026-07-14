import { SUBTITLE_URL_PATTERNS } from '@/shared/config/urls';
import { isValidIsoCode, toIso6391 } from './languageDetector';
import type {
  DetectedSubtitle,
  NetworkRequest,
  SubtitleFormat,
} from '@/entities/media';

const FORMAT_EXTENSIONS: ReadonlyArray<[SubtitleFormat, string]> = [
  ['ass', '.ass'],
  ['vtt', '.vtt'],
  ['srt', '.srt'],
];

/**
 * BCP 47 language tag pattern: primary subtag (2-3 letters) optionally
 * followed by subtags separated by hyphens (e.g. "en-US", "zh-Hans",
 * "pt-BR", "ar-EG"). Only the primary subtag is extracted for ISO lookup.
 *
 * Source: https://www.rfc-editor.org/rfc/rfc5646 (BCP 47)
 */
const BCP47_PATTERN = /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,3}$/i;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function detectFormat(url: string): SubtitleFormat | null {
  // First try to detect from file extension
  const pathname = url.split('?')[0]?.split('#')[0] ?? url;
  const lower = pathname.toLowerCase();
  for (const [format, ext] of FORMAT_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return format;
    }
  }

  // Try to detect from query parameters
  const urlParams = new URLSearchParams(url.split('?')[1] ?? '');
  const formatParam = urlParams.get('format') || urlParams.get('type') || urlParams.get('subtype');
  if (formatParam) {
    const normalizedFormat = formatParam.toLowerCase();
    for (const [format, ext] of FORMAT_EXTENSIONS) {
      if (normalizedFormat === format || normalizedFormat === ext.replace('.', '')) {
        return format;
      }
    }
  }

  // Default to vtt if URL matches subtitle patterns but no format found
  return 'vtt';
}

function extractLanguage(url: string): string {
  const pathname = url.split('?')[0]?.split('#')[0] ?? url;
  const filename = pathname.split('/').pop() ?? '';
  const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');
  const parts = filenameWithoutExt.split('.');

  if (parts.length >= 2) {
    const candidate = parts[parts.length - 1] ?? '';
    // BCP 47: extract primary subtag from tags like "en-US", "zh-Hans"
    if (BCP47_PATTERN.test(candidate)) {
      const primary = candidate.split('-')[0].toLowerCase();
      // Validate against ISO 639-1/639-2: reject folder-name false positives
      // like "sub", "vid", "api" that match the BCP47 shape (2-3 letters) but
      // are not real language codes. Without this, kisskh.co's
      // `/sub/<hash>.srt` URL extracts "sub" as the language, which is neither
      // a real language nor "unknown", so `resolveUnknownSubtitleLanguages`
      // never fires and auto-load fails (bug: kisskh autoload never triggered).
      if (isValidIsoCode(primary)) return toIso6391(primary);
    }
  }

  // Kebab-case language suffix: some sites (kisskh.buzz) use
  // `episode-1-en.srt` instead of `episode-1.en.srt`. Split by '-' and check
  // the last segment as a BCP47 primary subtag. isValidIsoCode guards against
  // false positives like "memories", "episode", "1" (not 2-3 letters or not
  // in ISO map).
  const kebabParts = filenameWithoutExt.split('-');
  if (kebabParts.length >= 2) {
    const candidate = kebabParts[kebabParts.length - 1] ?? '';
    if (BCP47_PATTERN.test(candidate)) {
      const primary = candidate.split('-')[0].toLowerCase();
      if (isValidIsoCode(primary)) return toIso6391(primary);
    }
  }

  // Language-index pattern: `<lang>-<index>.vtt` (e.g. `eng-2.vtt`,
  // `spa-5.vtt`, `por-4.vtt`). Used by aniwatch/megaplay subtitle CDNs
  // (lostproject.club) where the numeric suffix disambiguates multiple
  // tracks of the same language. The kebab path above fails because the
  // last segment is the index (`2`), not a BCP47 tag. Match the full
  // filename base against `^[a-z]{2,3}-\d+$` and take the primary subtag.
  const langIndexMatch = /^([a-z]{2,3})-\d+$/i.exec(filenameWithoutExt);
  if (langIndexMatch) {
    const primary = langIndexMatch[1].toLowerCase();
    if (isValidIsoCode(primary)) return toIso6391(primary);
  }

  const segments = pathname.split('/').filter((s) => s.length > 0);
  if (segments.length >= 2) {
    const candidate = segments[segments.length - 2] ?? '';
    if (BCP47_PATTERN.test(candidate)) {
      const primary = candidate.split('-')[0].toLowerCase();
      if (isValidIsoCode(primary)) return toIso6391(primary);
    }
  }

  return 'unknown';
}

/**
 * WebVTT files used as video metadata (not subtitles). These match `\.vtt`
 * but each cue is either an image URL (thumbnail/storyboard previews) or a
 * single chapter/episode marker spanning the whole video. Sites like
 * anime.nexus serve `.../stream/thumbnails.vtt` (seek preview, cues = image
 * URLs) and `.../stream/cues.vtt` (chapter marker, 1 cue "Episode" spanning
 * the full duration). Without this guard, both are detected as subtitles,
 * language-detected as English (URLs/words contain English), and selected
 * over the real ASS track by `findSubtitlesForOverlay` → ASS never auto-loads.
 *
 * ponytail: keyword-based exclusion. Ceiling: other metadata file names
 * would still false-positive. Upgrade: parse a small sample of the content
 * and reject when every cue line is a URL, or when there is only 1 cue
 * spanning the full video duration (chapter marker, not caption).
 */
const NON_SUBTITLE_KEYWORDS = /thumbnail|storyboard|chapter|preview|cues/i;

/**
 * Stremio addon subtitle listing API pattern. Stremio addons serve a JSON
 * listing of available subtitles at `/<api-prefix>/<type>/subtitles/<id>` —
 * e.g. torrentio: `https://stream.torrentio.to/api/v1/tmdb/subtitles/tt37287335`.
 * The response is JSON `{"subtitles": [{"url": "<real-subtitle-file>", "lang": "en"}, ...]}`,
 * NOT a subtitle file. Without this guard, `SUBTITLE_URL_PATTERNS`'s
 * `/subtitles/` segment matches the listing URL → the extension fetches JSON,
 * tries `parseVtt` → "missing WEBVTT header" → download fails at 50%.
 *
 * The real subtitle files are inside the JSON `subtitles[].url` field —
 * `resolveStremioSubtitleListing` (helpers.ts) fetches the listing, extracts
 * those URLs, and re-injects them through `handleRequest`.
 *
 * ponytail: pattern matches `/api/v<N>/<type>/subtitles/` — specific to
 * API-style Stremio addons (torrentio). Ceiling: a Stremio addon using the
 * bare protocol path `/<type>/subtitles/<id>` without `/api/v<N>/` would not
 * match. Upgrade: check response Content-Type (application/json) at fetch
 * time instead of URL-shape at detection time.
 */
const STREMIO_LISTING_PATTERN = /\/api\/v\d+\/[a-z]+\/subtitles\//i;

/** Is this URL a Stremio addon subtitle listing API (JSON), not a subtitle file? */
export function isStremioSubtitleListing(url: string): boolean {
  return STREMIO_LISTING_PATTERN.test(url);
}

export function detectSubtitle(
  request: NetworkRequest,
  opts?: { trustAsSubtitle?: boolean },
): DetectedSubtitle | null {
  // Reject Stremio addon listing URLs — they return JSON, not a subtitle file.
  // The real subtitle URLs are extracted from the JSON by
  // `resolveStremioSubtitleListing` and re-injected via `handleRequest`.
  if (isStremioSubtitleListing(request.url)) {
    return null;
  }

  // `trustAsSubtitle`: the caller already classified this URL as a subtitle
  // via a stronger signal than URL shape — e.g. a `<track kind="subtitles">`
  // element in the DOM (HTML spec: the element IS the classifier). Sites like
  // anikage.cc serve subtitles from `prox.anicore.tv/stream/<base64-hash>` with
  // no file extension and no `/subtitles|subs|caption|cc/` path segment, so
  // SUBTITLE_URL_PATTERNS never matches. The page scanner reads the `<track>`
  // element and trusts its semantics, bypassing the pattern check here.
  // The NON_SUBTITLE_KEYWORDS guard still runs (a `<track>` named "thumbnail"
  // is a seek-preview, not a subtitle).
  if (!opts?.trustAsSubtitle) {
    const matches = SUBTITLE_URL_PATTERNS.some((pattern) => pattern.test(request.url));
    if (!matches) {
      return null;
    }
  }

  // Reject thumbnail/storyboard/chapter VTT previews — not subtitles.
  if (NON_SUBTITLE_KEYWORDS.test(request.url)) {
    return null;
  }

  const format = detectFormat(request.url);
  if (format === null) {
    return null;
  }

  const language = extractLanguage(request.url);

  return {
    id: generateId(),
    url: request.url,
    format,
    language,
    tabId: request.tabId,
    detectedAt: request.timeStamp,
    initiator: request.initiator,
  };
}
