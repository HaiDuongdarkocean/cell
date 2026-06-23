import {
  Downloader,
  type ConvertCallback,
} from '@/background/downloader';
import type { DetectedVideo, DetectedSubtitle, DownloadProgress } from '@/types/media';
import { MAX_RETRY, SEGMENT_TIMEOUT_MS } from '@/constants/config';

// --- Mocks for global browser APIs ---

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
const createObjectURLMock = jest.fn<string, [Blob]>();
const revokeObjectURLMock = jest.fn<void, [string]>();
const chromeDownloadsDownloadMock = jest.fn<
  Promise<number>,
  [chrome.downloads.DownloadOptions]
>();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
  global.chrome = {
    downloads: {
      download: chromeDownloadsDownloadMock as unknown as typeof chrome.downloads.download,
    },
  } as unknown as typeof chrome;
  URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  fetchMock.mockReset();
  createObjectURLMock.mockReset();
  revokeObjectURLMock.mockReset();
  chromeDownloadsDownloadMock.mockReset();

  createObjectURLMock.mockImplementation((blob: Blob) => `blob:${blob.size}`);
  revokeObjectURLMock.mockImplementation(() => undefined);
  chromeDownloadsDownloadMock.mockResolvedValue(1);
});

afterEach(() => {
  jest.useRealTimers();
});

// --- Helpers ---

function makeTextBlob(text: string): Blob {
  const buf = new Uint8Array(Array.from(text, (c) => c.charCodeAt(0))).buffer;
  const blob = new Blob([text], { type: 'text/plain' });
  // jsdom's Blob may not implement .text()/.arrayBuffer(); patch them.
  const patched = blob as Blob & {
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
  };
  patched.text = async () => text;
  patched.arrayBuffer = async () => buf;
  responseTexts.set(blob, text);
  responseBuffers.set(blob, buf);
  return blob;
}

/**
 * Captured text used to back the mock Response, since jsdom's Blob may not
 * implement .text()/.arrayBuffer().
 */
const responseTexts = new WeakMap<Blob, string>();
const responseBuffers = new WeakMap<Blob, ArrayBuffer>();

function makeResponse(body: Blob, ok = true, status = 200): Response {
  const text = responseTexts.get(body) ?? '';
  const buf = responseBuffers.get(body) ?? new ArrayBuffer(0);
  return {
    ok,
    status,
    body: null,
    blob: async () => body,
    text: async () => text,
    arrayBuffer: async () => buf,
    json: async () => JSON.parse(text),
    headers: new Headers(),
    redirected: false,
    statusText: '',
    trailer: Promise.resolve(new Headers()),
    type: 'basic',
    url: '',
    clone: function () {
      return makeResponse(body, ok, status);
    },
  } as unknown as Response;
}

function makeMp4Video(overrides: Partial<DetectedVideo> = {}): DetectedVideo {
  return {
    id: 'v1',
    url: 'https://example.com/video.mp4',
    format: 'mp4',
    title: 'My Video',
    tabId: 1,
    tabUrl: 'https://example.com',
    detectedAt: 0,
    variants: [],
    ...overrides,
  };
}

function makeM3u8Video(overrides: Partial<DetectedVideo> = {}): DetectedVideo {
  return {
    id: 'v1',
    url: 'https://example.com/playlist.m3u8',
    format: 'm3u8',
    title: 'HLS Video',
    tabId: 1,
    tabUrl: 'https://example.com',
    detectedAt: 0,
    variants: [],
    ...overrides,
  };
}

const MEDIA_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:10',
  '#EXTINF:10.0,',
  'https://example.com/seg0.ts',
  '#EXTINF:10.0,',
  'https://example.com/seg1.ts',
  '#EXTINF:10.0,',
  'https://example.com/seg2.ts',
  '#EXT-X-ENDLIST',
].join('\n');

const MASTER_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720',
  'https://example.com/720p.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360',
  'https://example.com/360p.m3u8',
].join('\n');

describe('Downloader', () => {
  let downloader: Downloader;
  let progressEvents: DownloadProgress[];

  beforeEach(() => {
    downloader = new Downloader();
    progressEvents = [];
    downloader.onProgress((p: DownloadProgress) => {
      progressEvents.push(p);
    });
  });

  // 1. mp4 direct download
  test('downloadVideo with mp4 fetches URL and saves blob', async () => {
    const blob = makeTextBlob('mp4data');
    fetchMock.mockResolvedValue(makeResponse(blob));

    await downloader.downloadVideo(makeMp4Video(), 'dl1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/video.mp4');
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('My_Video.mp4');
    expect(opts.saveAs).toBe(false);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });

  // 2. m3u8 media playlist download
  test('downloadVideo with m3u8 fetches playlist, segments, merges, converts, saves', async () => {
    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    const seg0 = makeTextBlob('seg0');
    const seg1 = makeTextBlob('seg1');
    const seg2 = makeTextBlob('seg2');

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(seg0);
      if (url.endsWith('seg1.ts')) return makeResponse(seg1);
      if (url.endsWith('seg2.ts')) return makeResponse(seg2);
      throw new Error(`unexpected fetch ${url}`);
    });

    const convertMock: jest.MockedFunction<ConvertCallback> = jest.fn(
      async (_segments: ArrayBuffer[], _id: string) => {
        // simulate ffmpeg conversion
        return new ArrayBuffer(42);
      },
    );
    downloader.setConvertCallback(convertMock);

    await downloader.downloadVideo(makeM3u8Video(), 'dl2');

    // playlist + 3 segments fetched
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(convertMock).toHaveBeenCalledTimes(1);
    expect(convertMock.mock.calls[0][0]).toHaveLength(3);
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('HLS_Video.mp4');
  });

  // 3. m3u8 master playlist
  test('downloadVideo with m3u8 master playlist picks first variant, fetches, saves', async () => {
    const masterBlob = makeTextBlob(MASTER_PLAYLIST);
    const variantBlob = makeTextBlob(MEDIA_PLAYLIST);
    const seg0 = makeTextBlob('seg0');
    const seg1 = makeTextBlob('seg1');
    const seg2 = makeTextBlob('seg2');

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(masterBlob);
      if (url.endsWith('720p.m3u8')) return makeResponse(variantBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(seg0);
      if (url.endsWith('seg1.ts')) return makeResponse(seg1);
      if (url.endsWith('seg2.ts')) return makeResponse(seg2);
      throw new Error(`unexpected fetch ${url}`);
    });

    await downloader.downloadVideo(makeM3u8Video(), 'dl3');

    // master + variant playlist + 3 segments
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('HLS_Video.mp4');
  });

  // 4. subtitle .ass
  test('downloadSubtitle with .ass fetches, converts to srt, saves', async () => {
    const assContent = [
      '[Script Info]',
      'Title: test',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, Alignment',
      'Style: Default,Arial,20,&H00FFFFFF,2',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello world',
    ].join('\n');
    fetchMock.mockResolvedValue(makeResponse(makeTextBlob(assContent)));

    const sub: DetectedSubtitle = {
      id: 's1',
      url: 'https://example.com/sub.ass',
      format: 'ass',
      language: 'en',
      tabId: 1,
      detectedAt: 0,
    };

    await downloader.downloadSubtitle(sub, 'dl4');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('sub.srt');
  });

  // 5. subtitle .vtt
  test('downloadSubtitle with .vtt fetches, converts to srt, saves', async () => {
    const vttContent = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'Hello world',
    ].join('\n');
    fetchMock.mockResolvedValue(makeResponse(makeTextBlob(vttContent)));

    const sub: DetectedSubtitle = {
      id: 's1',
      url: 'https://example.com/sub.vtt',
      format: 'vtt',
      language: 'en',
      tabId: 1,
      detectedAt: 0,
    };

    await downloader.downloadSubtitle(sub, 'dl5');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('sub.srt');
  });

  // 6. subtitle .srt
  test('downloadSubtitle with .srt fetches and saves as-is', async () => {
    const srtContent = '1\n00:00:01,000 --> 00:00:02,000\nHello\n';
    fetchMock.mockResolvedValue(makeResponse(makeTextBlob(srtContent)));

    const sub: DetectedSubtitle = {
      id: 's1',
      url: 'https://example.com/sub.srt',
      format: 'srt',
      language: 'en',
      tabId: 1,
      detectedAt: 0,
    };

    await downloader.downloadSubtitle(sub, 'dl6');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('sub.srt');
  });

  // 7. fetchSegment retries on network error then succeeds
  test('fetchSegment retries on network error and succeeds within MAX_RETRY', async () => {
    const goodBlob = makeTextBlob('ok');
    fetchMock
      .mockRejectedValueOnce(new Error('net error 1'))
      .mockRejectedValueOnce(new Error('net error 2'))
      .mockResolvedValueOnce(makeResponse(goodBlob));

    const result = await downloader.fetchSegment('https://example.com/seg.ts');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toBeInstanceOf(Blob);
  });

  // 8. fetchSegment times out after SEGMENT_TIMEOUT_MS
  test('fetchSegment times out after SEGMENT_TIMEOUT_MS', async () => {
    // A fetch that never resolves; should be aborted by timeout.
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          // Simulate abort: reject when signal aborts.
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    const promise = downloader.fetchSegment('https://example.com/slow.ts');
    // Advance fake timers for each retry attempt's timeout.
    for (let i = 0; i < MAX_RETRY; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(SEGMENT_TIMEOUT_MS + 100);
    }
    await expect(promise).rejects.toThrow();

    // Should have retried MAX_RETRY times, each timing out.
    expect(fetchMock).toHaveBeenCalledTimes(MAX_RETRY);
  });

  // 9. cancel prevents further download steps
  test('cancel() prevents further download steps', async () => {
    const blob = makeTextBlob('mp4data');
    fetchMock.mockResolvedValue(makeResponse(blob));

    const video = makeMp4Video();
    downloader.cancel('dl9');
    await expect(downloader.downloadVideo(video, 'dl9')).rejects.toThrow(/cancel/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(chromeDownloadsDownloadMock).not.toHaveBeenCalled();
  });

  // 10. progressCallback called during download with correct values
  test('progressCallback called during download with correct progress values', async () => {
    const blob = makeTextBlob('mp4data');
    fetchMock.mockResolvedValue(makeResponse(blob));

    await downloader.downloadVideo(makeMp4Video(), 'dl10');

    expect(progressEvents.length).toBeGreaterThan(0);
    const last = progressEvents[progressEvents.length - 1];
    expect(last.itemId).toBe('dl10');
    expect(last.progress).toBe(100);
    expect(last.status).toBe('done');
  });
});
