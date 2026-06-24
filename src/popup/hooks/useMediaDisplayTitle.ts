import { useEffect, useState } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import { resolveFilenameBase } from '@/lib/utils/fileUtils';
import type {
  DetectedVideo,
  DetectedSubtitle,
  FilenameSource,
} from '@/types/media';

/**
 * Resolve the human-readable title shown in the popup for a detected media item.
 *
 * This applies the user's `filenameSource` setting to the display name, so the
 * popup shows the same base name that will be used for the download filename.
 *
 * - Video: uses the active tab title as the title candidate and the page URL
 *   (`tabUrl`) as the URL fallback. Stream URLs like `.../index.m3u8` produce
 *   generic names, so the page title / URL is more meaningful.
 * - Subtitle: language codes like "en" are not useful as a filename, so the
 *   title candidate is ignored and the subtitle URL is always used as the base.
 */
export function resolveMediaDisplayTitle(
  media: DetectedVideo | DetectedSubtitle,
  filenameSource: FilenameSource,
  tabTitle?: string,
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

  // Subtitle: language codes like "en" are not useful as filenames in any
  // mode. Always resolve from the subtitle URL, regardless of filenameSource.
  return resolveFilenameBase('url-only', undefined, media.url);
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
 * Hook that returns a display-title resolver bound to the current settings and
 * active tab title.
 */
export function useMediaDisplayTitle(): (
  media: DetectedVideo | DetectedSubtitle,
) => string {
  const filenameSource = usePopupStore((state) => state.settings.filenameSource);
  const tabTitle = useActiveTabTitle();

  return (media) => resolveMediaDisplayTitle(media, filenameSource, tabTitle);
}
