/**
 * Auto-download orchestration for whitelisted tabs.
 *
 * When {@link NetworkInterceptor.onMediaDetected} fires for a tab, the
 * background service calls {@link tryAutoDownload} to check whether the page
 * URL is on the user's auto-download whitelist and, if so, download the
 * best-matching media according to the user's preferences. Media detection is
 * incremental (the m3u8 is captured first, then subtitles arrive later), so
 * the caller passes the set of media ids it has already enqueued for this
 * page load and {@link tryAutoDownload} enqueues only the newly discovered
 * items — letting subtitles be caught up without re-downloading the video.
 *
 * The function is intentionally "pure-ish": all side-effecting collaborators
 * (`getMedia`, `createDownloadItem`, `addToQueue`) are injected so the core
 * decision logic can be unit-tested without spinning up the full background
 * service. The only ambient dependency is `chrome.storage.local`, used to load
 * persisted user settings.
 *
 * Per the spec, every non-whitelisted / no-media / no-match path is a silent
 * no-op ("im lặng, nút vẫn sáng") — the toolbar badge stays lit because the
 * media is still detected, we simply do not auto-start a download.
 */

import type {
  DetectedSubtitle,
  DetectedVideo,
  DownloadItem,
  Settings,
} from '@/types/media';
import { selectBestMedia } from '@/lib/selectors/selectBestMedia';
import { isWhitelisted } from '@/features/whitelist/whitelist';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/config/config';

/**
 * Side-effecting collaborators injected by the background service.
 * Keeping these as parameters (rather than importing the singleton) makes the
 * orchestrator testable without a real {@link BackgroundService} instance.
 */
export interface AutoDownloadDeps {
  /** Return the videos + subtitles currently detected for a tab. */
  readonly getMedia: (
    tabId: number,
  ) => { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] };
  /** Build a {@link DownloadItem} from a detected media object. */
  readonly createDownloadItem: (
    media: DetectedVideo | DetectedSubtitle,
    type: 'video' | 'subtitle',
  ) => DownloadItem;
  /** Enqueue one or more download items for processing. */
  readonly addToQueue: (items: DownloadItem[]) => void;
}

/**
 * Check whether a tab should auto-download (URL is whitelisted) and, if so,
 * trigger a download of the best-matching media according to user preferences.
 *
 * Steps:
 * 1. Normalize the URL and check it against the whitelist. Non-whitelisted →
 *    return silently.
 * 2. Load persisted settings from `chrome.storage.local`. Missing settings →
 *    return silently.
 * 3. Read detected media for the tab via `deps.getMedia`. No media → return
 *    silently.
 * 4. Run {@link selectBestMedia} against the detected media + settings. A
 *    `null` result (e.g. no videos) → return silently.
 * 5. Build a {@link DownloadItem} for the selected video and each selected
 *    subtitle, then enqueue them via `deps.addToQueue`.
 *
 * Media detection is incremental: {@link NetworkInterceptor.onMediaDetected}
 * fires first when the m3u8 is captured, then again when subtitles are
 * discovered. To support this, {@link tryAutoDownload} accepts an optional
 * `alreadyEnqueuedIds` set — the media ids the caller has already enqueued
 * for this page load. Any selected media whose id is in that set is skipped,
 * so a follow-up call enqueues only the newly discovered subtitles without
 * re-downloading the video.
 *
 * @param tabId              - The tab that finished loading.
 * @param tabUrl             - The tab's current URL (will be normalized).
 * @param deps               - Injected side-effecting collaborators.
 * @param alreadyEnqueuedIds - Media ids already enqueued for this page load
 *   (used for incremental subtitle catch-up). Defaults to an empty set, so the
 *   first call for a page load enqueues everything selected.
 * @returns The list of media ids that were enqueued this call. An empty array
 *   means a silent no-op (not whitelisted, no settings, no media, no match, or
 *   everything was already enqueued). Callers use the array both as a
 *   "did anything happen" signal and to track per-tab enqueued ids so
 *   subtitles discovered after the video can be caught up without
 *   re-downloading the video.
 */
export async function tryAutoDownload(
  tabId: number,
  tabUrl: string,
  deps: AutoDownloadDeps,
  alreadyEnqueuedIds: ReadonlySet<string> = new Set(),
): Promise<string[]> {
  // 1. Whitelist check (normalizes the URL internally).
  const whitelisted = await isWhitelisted(tabUrl);
  if (!whitelisted) return [];

  // 2. Load persisted settings, falling back to defaults so that a user who
  // has never opened the settings dialog still gets auto-downloads.
  let settings: Settings;
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const raw = data[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined;
    settings = { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return [];
  }

  // 3. Read detected media for the tab. No media → silent ("im lặng, nút vẫn sáng").
  const { videos, subtitles } = deps.getMedia(tabId);
  if (videos.length === 0 && subtitles.length === 0) return [];

  // 4. Select the best video + matching subtitles per user preferences.
  const result = selectBestMedia(videos, subtitles, settings);
  if (!result) return []; // silent

  // 5. Build download items for the selected video + each selected subtitle,
  //    skipping any media that was already enqueued for this page load. This
  //    lets a follow-up call (after subtitles are discovered) enqueue only the
  //    new subtitles without re-downloading the video.
  const items: DownloadItem[] = [];
  const enqueuedIds: string[] = [];

  if (!alreadyEnqueuedIds.has(result.videoId)) {
    const selectedVideo = videos.find((v) => v.id === result.videoId);
    if (selectedVideo) {
      items.push(deps.createDownloadItem(selectedVideo, 'video'));
      enqueuedIds.push(result.videoId);
    }
  }
  for (const subId of result.subtitleIds) {
    if (alreadyEnqueuedIds.has(subId)) continue;
    const sub = subtitles.find((s) => s.id === subId);
    if (sub) {
      items.push(deps.createDownloadItem(sub, 'subtitle'));
      enqueuedIds.push(subId);
    }
  }

  if (items.length > 0) {
    deps.addToQueue(items);
  }
  return enqueuedIds;
}
