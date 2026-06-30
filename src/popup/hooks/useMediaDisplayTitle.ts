import { useEffect, useState } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import { resolveFilenameBase, buildSubtitleFileName } from '@/shared/utils/fileUtils';
import type {
  DetectedVideo,
  DetectedSubtitle,
  FilenameSource,
} from '@/types/media';

/**
 * Optional video context for subtitle display title resolution.
 * When provided, the subtitle display title uses the video's title/URL as
 * the base name (matching the download filename), e.g. "Movie Title.en.srt".
 */
export interface VideoContext {
  videoTitle?: string;
  videoTabUrl?: string;
}

/**
 * Resolve the human-readable title shown in the popup for a detected media item.
 *
 * This applies the user's `filenameSource` setting to the display name, so the
 * popup shows the same base name that will be used for the download filename.
 *
 * - Video: uses the active tab title as the title candidate and the page URL
 *   (`tabUrl`) as the URL fallback. Stream URLs like `.../index.m3u8` produce
 *   generic names, so the page title / URL is more meaningful.
 * - Subtitle: when `videoContext` is provided, uses the video's title/URL as
 *   the base name + language suffix + subtitle format extension (e.g.
 *   "Movie Title.en.srt"), matching the download filename. When no video
 *   context, falls back to the subtitle's own URL base name.
 */
export function resolveMediaDisplayTitle(
  media: DetectedVideo | DetectedSubtitle,
  filenameSource: FilenameSource,
  tabTitle?: string,
  videoContext?: VideoContext,
): string {
  if ('format' in media && ['m3u8', 'mp4', 'ts', 'webm', 'unknown'].includes(media.format)) {
    // Video: prefer the enriched video.title (page title from background),
    // fall back to the popup-queried tabTitle, then to the page URL (tabUrl).
    // Use tabUrl (page URL) for URL-based naming, not video.url (stream URL).
    const video = media as DetectedVideo;
    const titleCandidate = video.title !== 'index' && video.title.length > 0
      ? video.title
      : tabTitle;
    const urlForFallback = video.tabUrl || video.url;
    return resolveFilenameBase(filenameSource, titleCandidate, urlForFallback);
  }

  // Subtitle: when video context is available, use the video's title/URL
  // as the base name (same as download filename), with language suffix +
  // subtitle format as extension. This makes the popup display match the
  // actual download filename.
  if (videoContext?.videoTabUrl) {
    const base = resolveFilenameBase(
      filenameSource,
      videoContext.videoTitle,
      videoContext.videoTabUrl,
    );
    const sub = media as DetectedSubtitle;
    return buildSubtitleFileName(base, sub.language, sub.format);
  }

  // No video context: fall back to the subtitle's own URL base name
  // (legacy behavior, used when no video is detected on the same tab).
  return resolveFilenameBase('url-only', undefined, (media as DetectedSubtitle).url);
}

/**
 * Returns the active tab title for the current popup window.
 */
export function useActiveTabTitle(): string | undefined {
  const [tabTitle, setTabTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const getTitle = async (): Promise<void> => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!cancelled) {
          setTabTitle(tab?.title);
        }
      } catch (error) {
        console.warn('[popup] Failed to query active tab title:', error);
      }
    };
    void getTitle();
    return () => {
      cancelled = true;
    };
  }, []);

  return tabTitle;
}

/**
 * Hook that returns a display-title resolver bound to the current settings,
 * active tab title, and detected videos (for subtitle filename matching).
 *
 * For subtitles, the resolver automatically looks up the first video on the
 * same tab and passes its title/URL as video context, so the subtitle display
 * title matches the download filename (e.g. "Movie Title.en.srt").
 */
export function useMediaDisplayTitle(): (
  media: DetectedVideo | DetectedSubtitle,
) => string {
  const filenameSource = usePopupStore((state) => state.settings.filenameSource);
  const tabTitle = useActiveTabTitle();
  const videos = usePopupStore((state) => state.videos);

  return (media) => {
    // For subtitles, find the first video on the same tab to use as context.
    if ('format' in media && ['ass', 'vtt', 'srt'].includes(media.format)) {
      const sub = media as DetectedSubtitle;
      const linkedVideo = videos.find((v) => v.tabId === sub.tabId);
      const videoContext = linkedVideo
        ? { videoTitle: linkedVideo.title, videoTabUrl: linkedVideo.tabUrl }
        : undefined;
      return resolveMediaDisplayTitle(media, filenameSource, tabTitle, videoContext);
    }
    return resolveMediaDisplayTitle(media, filenameSource, tabTitle);
  };
}
