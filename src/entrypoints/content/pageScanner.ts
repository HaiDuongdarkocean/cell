import {
  VIDEO_URL_PATTERNS,
  SUBTITLE_URL_PATTERNS,
} from '@/shared/config/urls';
import {
  isValidIsoCode,
  labelToIsoCode,
  toIso6391,
} from '@/shared/config/languageRegistry';
import { queryAllShadow } from '@/shared/lib/dom/videoFinder';

export interface ScannedTrack {
  url: string;
  label: string;
  language: string;
  isDefault: boolean;
}

export interface ScannedUrls {
  videoUrls: string[];
  subtitleUrls: string[];
  trackSubtitles: ScannedTrack[];
}

function matchesPattern(url: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(url));
}

function isVideoUrl(url: string): boolean {
  return matchesPattern(url, VIDEO_URL_PATTERNS);
}

function isSubtitleUrl(url: string): boolean {
  return matchesPattern(url, SUBTITLE_URL_PATTERNS);
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isNetworkUrl(url: string): boolean {
  return !/^(blob|data):/i.test(url);
}

function resolveTrackLanguage(label: string, srclang: string): string {
  const srclangLower = srclang.trim().toLowerCase();
  if (srclangLower) {
    const primary = srclangLower.split('-')[0] ?? '';
    if (isValidIsoCode(primary)) {
      return toIso6391(primary);
    }
  }
  const fromLabel = labelToIsoCode(label.trim());
  if (fromLabel) {
    return toIso6391(fromLabel);
  }
  return 'unknown';
}

function resolveTrackDisplayName(label: string, srclang: string, url: string): string {
  const labelText = label.trim();
  if (labelText) return labelText;
  const srclangText = srclang.trim();
  if (srclangText) return srclangText;
  try {
    return new URL(url).pathname.split('/').pop() ?? '';
  } catch {
    return '';
  }
}

/**
 * PageScanner scans the page DOM for video and subtitle URLs and observes
 * the DOM for dynamically loaded media content.
 */
export class PageScanner {
  private observer: MutationObserver | null = null;
  private onScanCallback: ((urls: ScannedUrls) => void) | null = null;
  private lastScanned: ScannedUrls = { videoUrls: [], subtitleUrls: [], trackSubtitles: [] };
  private rescanTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // no-op
  }

  /**
   * Scan the current page DOM for video and subtitle URLs.
   */
  scan(): ScannedUrls {
    return this.extractUrlsFromDOM(document);
  }

  /**
   * Extract video and subtitle URLs from a given document.
   *
   * Looks at `<video>`, `<source>`, `<track>`, and `<a>` elements, filters the
   * discovered URLs against the known video/subtitle patterns, and returns the
   * deduplicated lists.
   *
   * `<track>` element URLs bypass the subtitle URL-pattern filter: the element
   * itself is the semantic classifier (HTML spec — `<track kind="subtitles">`
   * IS a subtitle track). Sites like anikage.cc serve subtitles from
   * `prox.anicore.tv/stream/<base64-hash>` with no extension and no subtitle
   * path segment, so SUBTITLE_URL_PATTERNS never matches. Pattern-filtering
   * `<track>` URLs would discard the strongest available signal.
   */
  extractUrlsFromDOM(doc: Document): ScannedUrls {
    const videoUrls: string[] = [];
    const patternSubtitleUrls: string[] = [];
    // <track>-origin URLs: trusted as subtitles regardless of URL shape.
    const trackSubtitleUrls: string[] = [];
    const trackSubtitles: ScannedTrack[] = [];

    for (const el of queryAllShadow<Element>('video,source,track,a[href]', doc)) {
      switch (el.localName) {
        case 'video': {
          const src = el.getAttribute('src');
          if (src) {
            videoUrls.push(src);
          }
          break;
        }
        case 'source': {
          const src = el.getAttribute('src');
          if (src) {
            videoUrls.push(src);
          }
          break;
        }
        case 'track': {
          const src = el.getAttribute('src');
          if (!src) break;
          trackSubtitleUrls.push(src);
          const label = el.getAttribute('label') ?? '';
          const srclang = el.getAttribute('srclang') ?? '';
          trackSubtitles.push({
            url: src,
            label: resolveTrackDisplayName(label, srclang, src),
            language: resolveTrackLanguage(label, srclang),
            isDefault: (el as HTMLTrackElement).default,
          });
          break;
        }
        case 'a': {
          const href = el.getAttribute('href');
          if (!href) break;
          if (isVideoUrl(href)) {
            videoUrls.push(href);
          } else if (isSubtitleUrl(href)) {
            patternSubtitleUrls.push(href);
          }
          break;
        }
      }
    }

    // Filter and deduplicate. <track> URLs are already classified by the
    // element — only dedupe, do not pattern-filter.
    // Blob / data URLs are player-local object URLs: they cannot be re-fetched
    // from the network, but a <track src="blob:..."> is the decrypted subtitle
    // stream the player created. The page scanner trusts the track and passes
    // the URL along; the content script can fetch the blob directly.
    const filteredVideo = dedupe(videoUrls.filter(isVideoUrl).filter(isNetworkUrl));
    const filteredPatternSubtitle = dedupe(patternSubtitleUrls.filter(isNetworkUrl));
    const filteredTrackSubtitle = dedupe(trackSubtitleUrls);
    const filteredTrackSubtitles = dedupeBy(
      trackSubtitles,
      (t) => t.url,
    );

    return {
      videoUrls: filteredVideo,
      subtitleUrls: dedupe([...filteredPatternSubtitle, ...filteredTrackSubtitle]),
      trackSubtitles: filteredTrackSubtitles,
    };
  }

  /**
   * Start observing DOM mutations for dynamically loaded content. When new
   * media URLs are discovered, the provided callback is invoked with the
   * complete current set of URLs.
   */
  startObserving(callback: (urls: ScannedUrls) => void): void {
    this.stopObserving();
    this.onScanCallback = callback;
    this.lastScanned = this.scan();

    this.observer = new MutationObserver((mutations) => {
      if (!this.mutationTouchesMediaElements(mutations)) return;
      if (this.rescanTimer !== null) return;
      this.rescanTimer = setTimeout(() => {
        this.rescanTimer = null;
        this.rescanIfChanged();
      }, 250);
    });

    const root = document.body ?? document.documentElement;
    // childList catches <track>/<source> elements added after DOMContentLoaded;
    // attributeFilter catches players that mount elements first and then set
    // src/href later (vidstack/hls.js on vidnest sets track.src after mount).
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href'],
    });
  }

  /**
   * Return the last scanned URL set. Useful for callers that need to decide
   * whether a re-scan is worth sending a new PAGE_SCAN_RESULT.
   */
  getLastScanned(): ScannedUrls {
    return { ...this.lastScanned };
  }

  private mutationTouchesMediaElements(mutations: readonly MutationRecord[]): boolean {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (
          target instanceof Element &&
          /^(VIDEO|SOURCE|TRACK|A)$/.test(target.tagName)
        ) {
          return true;
        }
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (/^(VIDEO|SOURCE|TRACK|A)$/.test(node.tagName)) return true;
        if (node.querySelector('video,source,track,a[href]')) return true;
      }
    }
    return false;
  }

  private rescanIfChanged(): void {
    const current = this.scan();
    const hasNewVideo = current.videoUrls.some((u) => !this.lastScanned.videoUrls.includes(u));
    const hasNewSubtitle = current.subtitleUrls.some(
      (u) => !this.lastScanned.subtitleUrls.includes(u),
    );
    const hasNewTrack = current.trackSubtitles.some(
      (t) => !this.lastScanned.trackSubtitles.some((lt) => lt.url === t.url),
    );
    if (hasNewVideo || hasNewSubtitle || hasNewTrack) {
      this.lastScanned = current;
      this.onScanCallback?.(current);
    }
  }

  /**
   * Stop observing DOM mutations.
   */
  stopObserving(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.onScanCallback = null;
    if (this.rescanTimer !== null) {
      clearTimeout(this.rescanTimer);
      this.rescanTimer = null;
    }
  }
}
