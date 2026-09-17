import type { DetectedSubtitle, FilenameSource, SubtitleFormat } from '@/entities/media';
import { sendTabMessage } from '@/shared/lib/chrome-apis/tabs';
import { setRefererRule, removeRefererRule } from '@/shared/lib/chrome-apis/declarativeNetRequest';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  isPhimwarSubtitleUrl,
  decryptPhimwarSrtFromUrl,
} from '@/shared/lib/parsers/phimwarDecryption';
import { decryptAndDetectFormat } from '@/shared/lib/parsers/encryptedFile';
import { convertAssToSrt } from '@/shared/lib/parsers/assToSrt';
import { convertVttToSrt } from '@/shared/lib/parsers/vttToSrt';
import { convertTtmlToSrt } from '@/shared/lib/parsers/ttmlToSrt';
import { normalizeSrt } from '@/shared/lib/parsers/srtNormalizer';
import { resolveFilenameBase, buildSubtitleFileName } from '@/shared/utils/fileUtils';

/**
 * Context of the video a subtitle is linked to (via `subtitle.videoId`).
 * When present, the subtitle filename shares the video's base name.
 */
export interface SubtitleVideoContext {
  videoTitle?: string;
  videoTabUrl?: string;
}

function isSameOriginUrl(subtitleUrl: string, pageUrl: string | undefined): boolean {
  try {
    const subOrigin = new URL(subtitleUrl).origin;
    const pageOrigin = pageUrl ? new URL(pageUrl).origin : '';
    return subOrigin !== '' && subOrigin === pageOrigin;
  } catch {
    return false;
  }
}

/**
 * Fetch the raw subtitle text.
 *
 * Same-origin subtitle endpoints often require the page's authenticated
 * session cookies; the service worker / offscreen fetch cannot send them.
 * We first ask the content script, which runs in the page origin, to fetch
 * the raw text, then fall back to the service worker if it fails.
 *
 * For the service-worker path we prefer the request `initiator` (iframe
 * player origin) as the Referer — many subtitle CDNs (e.g. lostproject.club
 * behind megaplay.buzz) reject the top-level tab URL and return 403. Since
 * `fetch()` from the extension SW cannot set `Referer` (forbidden header),
 * we register a `declarativeNetRequest` dynamic rule scoped to this exact
 * URL + extension origin so the browser rewrites `Referer` before the
 * request leaves the network stack. The rule is removed after the fetch
 * completes (success or failure).
 *
 * PhimWar and HUBPHIM-style sites serve encrypted payloads, which are
 * decrypted before returning.
 */
export async function fetchSubtitleContent(
  subtitle: DetectedSubtitle,
  videoContext: SubtitleVideoContext | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const refererSource = subtitle.initiator ?? videoContext?.videoTabUrl;
  const isPhimwar = isPhimwarSubtitleUrl(subtitle.url);
  const sameOrigin = isSameOriginUrl(
    subtitle.url,
    subtitle.initiator ?? videoContext?.videoTabUrl,
  );

  let content: string | undefined;
  if (sameOrigin || isPhimwar) {
    try {
      const res = await sendTabMessage<{ success: boolean; content?: string; error?: string }>(
        subtitle.tabId,
        {
          type: MESSAGE_TYPES.FETCH_SUBTITLE_PAGE_CONTEXT,
          payload: { url: subtitle.url },
        },
      );
      if (res?.success && typeof res.content === 'string') {
        content = res.content;
      }
    } catch (err) {
      console.warn('[downloadSubtitle] page-context fetch failed, falling back to service worker:', err);
    }
  }

  if (content === undefined) {
    let ruleId: number | undefined;
    if (refererSource) {
      try {
        ruleId = await setRefererRule(subtitle.url, refererSource);
      } catch (err) {
        console.warn('[downloadSubtitle] setRefererRule failed, proceeding without DNR rule:', err);
      }
    }
    let response: Response;
    try {
      response = await fetch(subtitle.url, {
        credentials: 'same-origin',
        signal,
      });
    } finally {
      if (ruleId !== undefined) {
        void removeRefererRule(ruleId).catch(() => {});
      }
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch subtitle: ${response.status}`);
    }
    content = await response.text();
  }

  if (isPhimwar) {
    try {
      content = await decryptPhimwarSrtFromUrl(subtitle.url, content);
    } catch (err) {
      throw new Error(
        `Encrypted subtitle decryption failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err },
      );
    }
  }

  if (content === undefined) {
    throw new Error('Subtitle content unavailable');
  }
  return content;
}

/**
 * Decrypt HUBPHIM-style payloads, sniff the real format, convert to SRT and
 * normalize the output to clean, standard-compliant SRT — regardless of
 * source format. This catches non-standard SRT from servers (VTT tags in
 * .srt, dot timestamps, missing sequence numbers, WEBVTT header in .srt,
 * etc.) and also guards against any tags that slip through the upstream
 * converters.
 *
 * Content is trusted over `detectedFormat` because API endpoints like
 * tophim's /api/subtitles/play have no extension to reveal the format.
 */
export function convertSubtitleToSrt(
  content: string,
  detectedFormat: SubtitleFormat,
): string {
  const { content: decryptedContent, format: sniffedFormat } = decryptAndDetectFormat(content);
  const format = sniffedFormat ?? detectedFormat;
  if (!format || format === 'unknown') {
    throw new Error('Cannot determine subtitle format');
  }

  let srtContent: string;
  if (format === 'ass') {
    srtContent = convertAssToSrt(decryptedContent);
  } else if (format === 'vtt') {
    srtContent = convertVttToSrt(decryptedContent);
  } else if (format === 'ttml') {
    // ADR-029: Netflix serves IMSC1.1 TTML. convertTtmlToSrt is regex-based
    // (no DOMParser) so it works in the service worker where this runs.
    srtContent = convertTtmlToSrt(decryptedContent);
  } else if (format === 'srt') {
    srtContent = decryptedContent;
  } else {
    throw new Error(`Unsupported subtitle format: ${format}`);
  }

  return normalizeSrt(srtContent);
}

/**
 * Resolve the subtitle's download filename. When a linked video is present
 * the base name matches the video's (e.g. `See_You_at_Work_Tomorrow!.en.srt`);
 * otherwise the subtitle's own URL base name is used (e.g. `sub.en.srt`).
 * The language tag is appended before the extension (VLC/community
 * convention for auto-loading).
 */
export function resolveSubtitleFilename(
  filenameSource: FilenameSource,
  subtitle: DetectedSubtitle,
  videoContext: SubtitleVideoContext | undefined,
): string {
  const base = videoContext?.videoTabUrl
    ? resolveFilenameBase(
        filenameSource,
        videoContext.videoTitle,
        videoContext.videoTabUrl,
      )
    : resolveFilenameBase(filenameSource, undefined, subtitle.url);
  return buildSubtitleFileName(base, subtitle.language, 'srt');
}
