import { PageScanner } from '@/entrypoints/content/pageScanner';
import type { ScannedUrls } from '@/entrypoints/content/pageScanner';

describe('PageScanner', () => {
  let scanner: PageScanner;

  beforeEach(() => {
    scanner = new PageScanner();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    scanner.stopObserving();
    document.body.innerHTML = '';
  });

  describe('extractUrlsFromDOM', () => {
    it('extracts src from a <video> element', () => {
      document.body.innerHTML = '<video src="https://example.com/movie.mp4"></video>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toContain('https://example.com/movie.mp4');
    });

    it('extracts src from a <source> child of <video>', () => {
      document.body.innerHTML =
        '<video><source src="https://example.com/movie.m3u8"></video>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toContain('https://example.com/movie.m3u8');
    });

    it('extracts src from a standalone <source> element', () => {
      document.body.innerHTML = '<source src="https://example.com/clip.webm">';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toContain('https://example.com/clip.webm');
    });

    it('extracts src from a <track> element as a subtitle URL', () => {
      document.body.innerHTML = '<video src="https://example.com/movie.mp4"><track src="https://example.com/sub.vtt"></video>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.subtitleUrls).toContain('https://example.com/sub.vtt');
    });

    // Regression: anikage.cc serves subtitles from
    // `prox.anicore.tv/stream/<base64-hash>` — no file extension, no subtitle
    // path segment. The `<track kind="subtitles">` element is the only signal.
    // Pattern-filtering `<track>` URLs would discard this signal → subtitle
    // never detected. The scanner must trust the element and bypass the
    // SUBTITLE_URL_PATTERNS filter for `<track>`-origin URLs.
    it('extracts <track> src even when the URL matches no subtitle pattern (anikage.cc regression)', () => {
      document.body.innerHTML =
        '<video src="blob:https://anikage.cc/abc"><track kind="subtitles" label="English" srclang="English" src="https://prox.anicore.tv/stream/CQQGHwtDHR9RUg9eEwERA1NCUxgSBB0dHVZBRVBCCAQeCgtW"></track></video>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.subtitleUrls).toContain(
        'https://prox.anicore.tv/stream/CQQGHwtDHR9RUg9eEwERA1NCUxgSBB0dHVZBRVBCCAQeCgtW',
      );
      expect(result.trackSubtitles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://prox.anicore.tv/stream/CQQGHwtDHR9RUg9eEwERA1NCUxgSBB0dHVZBRVBCCAQeCgtW',
            label: 'English',
            language: 'en',
            isDefault: false,
          }),
        ]),
      );
    });

    it('extracts blob:<track> URLs with metadata from OnzLoad-style players', () => {
      document.body.innerHTML =
        '<video src="blob:https://onzload.com/abc"><track kind="subtitles" label="Tiếng Việt" srclang="vi" default src="blob:https://onzload.com/vi"></track><track kind="subtitles" label="Song ngữ" srclang="mul" src="blob:https://onzload.com/mul"></track></video>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.subtitleUrls).toContain('blob:https://onzload.com/vi');
      expect(result.subtitleUrls).toContain('blob:https://onzload.com/mul');
      expect(result.trackSubtitles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'blob:https://onzload.com/vi',
            label: 'Tiếng Việt',
            language: 'vi',
            isDefault: true,
          }),
          expect.objectContaining({
            url: 'blob:https://onzload.com/mul',
            label: 'Song ngữ',
            language: 'unknown',
            isDefault: false,
          }),
        ]),
      );
    });

    it('still pattern-filters <a> subtitle hrefs (only <track> bypasses the filter)', () => {
      // An <a> href without a subtitle extension/path must NOT be classified as
      // a subtitle — only the `<track>` element carries semantic subtitle intent.
      document.body.innerHTML =
        '<a href="https://prox.anicore.tv/stream/somehash">download</a>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.subtitleUrls).toEqual([]);
    });

    it('extracts video URL from an <a> tag matching video patterns', () => {
      document.body.innerHTML = '<a href="https://example.com/download/video.mp4">Download</a>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toContain('https://example.com/download/video.mp4');
    });

    it('extracts subtitle URL from an <a> tag matching subtitle patterns', () => {
      document.body.innerHTML = '<a href="https://example.com/subs/en.srt">Subtitles</a>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.subtitleUrls).toContain('https://example.com/subs/en.srt');
    });

    it('returns empty arrays when no media elements are present', () => {
      document.body.innerHTML = '<div><p>no media here</p></div>';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toEqual([]);
      expect(result.subtitleUrls).toEqual([]);
    });

    it('deduplicates repeated URLs across multiple elements', () => {
      document.body.innerHTML = `
        <video src="https://example.com/movie.mp4"></video>
        <video src="https://example.com/movie.mp4"></video>
        <a href="https://example.com/movie.mp4">link</a>
      `;

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toEqual(['https://example.com/movie.mp4']);
    });

    it('filters out non-media URLs from <a> tags', () => {
      document.body.innerHTML = `
        <a href="https://example.com/page/about">About</a>
        <a href="https://example.com/image.png">Image</a>
      `;

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toEqual([]);
      expect(result.subtitleUrls).toEqual([]);
    });

    it('ignores empty src attributes', () => {
      document.body.innerHTML = '<video src=""></video><source src="">';

      const result = scanner.extractUrlsFromDOM(document);

      expect(result.videoUrls).toEqual([]);
      expect(result.subtitleUrls).toEqual([]);
    });
  });

  describe('scan', () => {
    it('returns the same result as extractUrlsFromDOM(document)', () => {
      document.body.innerHTML = '<video src="https://example.com/movie.mp4"></video>';

      const scanned = scanner.scan();
      const extracted = scanner.extractUrlsFromDOM(document);

      expect(scanned).toEqual(extracted);
      expect(scanned.videoUrls).toContain('https://example.com/movie.mp4');
    });

    it('returns empty result when the page has no media', () => {
      document.body.innerHTML = '<div>nothing</div>';

      const result = scanner.scan();

      expect(result.videoUrls).toEqual([]);
      expect(result.subtitleUrls).toEqual([]);
    });
  });

  describe('startObserving / stopObserving', () => {
    it('calls the callback when new media is added to the DOM', async () => {
      const callback = jest.fn();
      scanner.startObserving(callback);

      // Add a video element after observing starts.
      const video = document.createElement('video');
      video.src = 'https://example.com/dynamic.mp4';
      document.body.appendChild(video);

      // jsdom MutationObserver fires on a microtask; flush it.
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalled();
      const result: ScannedUrls = callback.mock.calls[0][0];
      expect(result.videoUrls).toContain('https://example.com/dynamic.mp4');
    });

    it('does not call the callback after stopObserving', async () => {
      const callback = jest.fn();
      scanner.startObserving(callback);
      scanner.stopObserving();

      const video = document.createElement('video');
      video.src = 'https://example.com/late.mp4';
      document.body.appendChild(video);

      await Promise.resolve();
      await Promise.resolve();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
