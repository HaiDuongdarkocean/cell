import { VIDEO_URL_PATTERNS, SUBTITLE_URL_PATTERNS } from '@/shared/config/urls';

export interface ScannedUrls {
  videoUrls: string[];
  subtitleUrls: string[];
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

/**
 * PageScanner scans the page DOM for video and subtitle URLs and observes
 * the DOM for dynamically loaded media content.
 */
export class PageScanner {
  private observer: MutationObserver | null = null;
  private onScanCallback: ((urls: ScannedUrls) => void) | null = null;
  private lastScanned: ScannedUrls = { videoUrls: [], subtitleUrls: [] };

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
   */
  extractUrlsFromDOM(doc: Document): ScannedUrls {
    const videoUrls: string[] = [];
    const subtitleUrls: string[] = [];

    // <video> elements: collect the element's own src plus child <source> srcs.
    const videos = Array.from(doc.querySelectorAll('video'));
    for (const video of videos) {
      const src = video.getAttribute('src');
      if (src) {
        videoUrls.push(src);
      }
      const sources = Array.from(video.querySelectorAll('source'));
      for (const source of sources) {
        const sourceSrc = source.getAttribute('src');
        if (sourceSrc) {
          videoUrls.push(sourceSrc);
        }
      }
    }

    // All <source> elements (including those not nested in <video>).
    const allSources = Array.from(doc.querySelectorAll('source'));
    for (const source of allSources) {
      const src = source.getAttribute('src');
      if (src) {
        videoUrls.push(src);
      }
    }

    // <track> elements are subtitles.
    const tracks = Array.from(doc.querySelectorAll('track'));
    for (const track of tracks) {
      const src = track.getAttribute('src');
      if (src) {
        subtitleUrls.push(src);
      }
    }

    // <a> elements: classify hrefs against video/subtitle patterns.
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href');
      if (!href) {
        continue;
      }
      if (isVideoUrl(href)) {
        videoUrls.push(href);
      } else if (isSubtitleUrl(href)) {
        subtitleUrls.push(href);
      }
    }

    // Filter and deduplicate.
    const filteredVideo = dedupe(videoUrls.filter(isVideoUrl));
    const filteredSubtitle = dedupe(subtitleUrls.filter(isSubtitleUrl));

    return { videoUrls: filteredVideo, subtitleUrls: filteredSubtitle };
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

    this.observer = new MutationObserver(() => {
      const current = this.scan();
      const hasNewVideo = current.videoUrls.some((u) => !this.lastScanned.videoUrls.includes(u));
      const hasNewSubtitle = current.subtitleUrls.some(
        (u) => !this.lastScanned.subtitleUrls.includes(u),
      );
      if (hasNewVideo || hasNewSubtitle) {
        this.lastScanned = current;
        this.onScanCallback?.(current);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Stop observing DOM mutations.
   */
  stopObserving(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.onScanCallback = null;
  }
}
