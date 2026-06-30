import {
  Downloader,
  buildFetchHeaders,
  type ConvertCallback,
  type ConvertResult,
} from '@/background/downloader';
import type { DetectedVideo, DetectedSubtitle, DownloadProgress, SegmentRange } from '@/types/media';
import { MAX_RETRY, SEGMENT_TIMEOUT_MS } from '@/shared/config/config';

// Mock OPFS helpers so we can control whether the streaming path is used.
// `createOpfsWriter` returns a mock writer that records all write calls in
// order, so tests can verify segment ordering.
//
// Note: `jest.mock` factories are hoisted above all declarations, so we cannot
// reference variables declared outside the factory. We create the mock writer
// inside the factory and attach it to `globalThis` so tests can access it.
jest.mock('@/shared/lib/storage/opfsStorage', () => {
  const mockWriter = {
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  // Expose via globalThis so tests can access it after import.
  (globalThis as Record<string, unknown>).__mockWriter = mockWriter;
  return {
    ensureDownloadSubdir: jest.fn(),
    appendChunk: jest.fn(),
    createOpfsWriter: jest.fn().mockResolvedValue(mockWriter),
    readFile: jest.fn(),
    deleteFile: jest.fn(),
    deleteDownloadSubdir: jest.fn().mockResolvedValue(undefined),
    isOpfsAvailable: jest.fn().mockReturnValue(false),
    isQuotaExceededError: jest.fn((err: unknown) =>
      err instanceof DOMException && err.name === 'QuotaExceededError',
    ),
  };
});

import { isOpfsAvailable } from '@/shared/lib/storage/opfsStorage';

// Convenience accessor for the mock writer (populated by the jest.mock factory).
const mockWriter = (globalThis as Record<string, unknown>).__mockWriter as {
  write: jest.Mock;
  close: jest.Mock;
};

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
      search: jest.fn().mockResolvedValue([]) as unknown as typeof chrome.downloads.search,
    },
  } as unknown as typeof chrome;
  URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;

  // jsdom does not implement Blob.prototype.arrayBuffer; polyfill it via
  // FileReader so saveBlob's data-URL conversion can run in tests. Real MV3
  // service workers provide Blob.arrayBuffer natively.
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function arrayBuffer(): Promise<ArrayBuffer> {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }

  // jsdom does not implement crypto.subtle; polyfill with Node's WebCrypto.
  // This is required for AES-128 decryption tests (importKey, encrypt, decrypt).
  const { webcrypto } = require('crypto');
  if (!global.crypto) {
    global.crypto = webcrypto as unknown as Crypto;
  } else if (!global.crypto.subtle) {
    Object.defineProperty(global.crypto, 'subtle', {
      value: webcrypto.subtle,
      writable: false,
      configurable: true,
    });
  }
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
 * Creates a Blob backed by raw bytes, with patched `.arrayBuffer()` for jsdom.
 */
function makeBlob(data: Uint8Array, type: string = 'application/octet-stream'): Blob {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([buf], { type });
  const patched = blob as Blob & {
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
  };
  patched.text = async () => '';
  patched.arrayBuffer = async () => buf;
  responseTexts.set(blob, '');
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
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/video.mp4', {
      credentials: 'same-origin',
      headers: buildFetchHeaders('https://example.com'),
    });
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('My_Video.mp4');
    expect(opts.saveAs).toBe(false);
    // MV3 service workers lack URL.createObjectURL, so the blob is saved as a
    // base64 data URL instead.
    expect(opts.url).toMatch(/^data:.*;base64,/);
  });

  // 2. m3u8 media playlist download with conversion (streaming + OPFS path)
  test('downloadVideo with m3u8 streams to OPFS, converts, saves mp4', async () => {
    // Enable OPFS for this test so the streaming path is used.
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

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

    // Mock OPFS: simulate reading a converted mp4 file.
    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = { name: 'dl2' } as unknown as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    // readFile returns a mock File for the converted output.
    const mockMp4File = {
      arrayBuffer: async () => new ArrayBuffer(42),
    } as unknown as File;
    readFile.mockResolvedValue(mockMp4File);

    const convertMock: jest.MockedFunction<ConvertCallback> = jest.fn(
      async (
        _dirHandle: FileSystemDirectoryHandle,
        _id: string,
      ): Promise<ConvertResult> => {
        return { outputName: 'output.mp4', mimeType: 'video/mp4' };
      },
    );
    downloader.setConvertCallback(convertMock);

    await downloader.downloadVideo(makeM3u8Video(), 'dl2');

    // playlist fetched with credentials:'same-origin'; segments also 'same-origin'
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/playlist.m3u8', {
      credentials: 'same-origin',
      headers: buildFetchHeaders('https://example.com'),
    });
    // Writer opened once, 3 segments written, writer closed once
    expect(createOpfsWriter).toHaveBeenCalledTimes(1);
    expect(mockWriter.write).toHaveBeenCalledTimes(3);
    expect(mockWriter.close).toHaveBeenCalledTimes(1);
    // Convert callback called with dirHandle + downloadId
    expect(convertMock).toHaveBeenCalledTimes(1);
    expect(convertMock.mock.calls[0][1]).toBe('dl2');
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('HLS_Video.mp4');
    // OPFS cleanup called
    expect(deleteDownloadSubdir).toHaveBeenCalledWith('dl2');

    // Reset OPFS availability for subsequent tests
    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 2b. Segment byte ranges are recorded during streaming download
  test('downloadVideo with m3u8 records segment byte ranges', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    // Create segments with known sizes: seg0=4 bytes, seg1=4 bytes, seg2=4 bytes
    const seg0 = makeTextBlob('seg0'); // 4 bytes
    const seg1 = makeTextBlob('seg1'); // 4 bytes
    const seg2 = makeTextBlob('seg2'); // 4 bytes

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(seg0);
      if (url.endsWith('seg1.ts')) return makeResponse(seg1);
      if (url.endsWith('seg2.ts')) return makeResponse(seg2);
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = { name: 'dl-ranges' } as unknown as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    const mockTsFile = {
      arrayBuffer: async () => new ArrayBuffer(12),
    } as unknown as File;
    readFile.mockResolvedValue(mockTsFile);

    // No convert callback → saves .ts directly, but ranges should still be recorded.
    await downloader.downloadVideo(makeM3u8Video(), 'dl-ranges');

    // Verify segment ranges were recorded (before cleanup deletes them).
    // Note: getSegmentRanges returns [] after cleanup because the map is
    // cleared. So we need to check during the download. Instead, verify
    // via the writer.write calls that segments were written in order.
    expect(mockWriter.write).toHaveBeenCalledTimes(3);

    // After download completes, segmentRangesMap is cleaned up.
    expect(downloader.getSegmentRanges('dl-ranges')).toEqual([]);

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 2c. Segment ranges are contiguous and sum to total bytes
  test('getSegmentRanges returns contiguous ranges during download', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    const seg0 = makeTextBlob('AAAA'); // 4 bytes
    const seg1 = makeTextBlob('BBBB'); // 4 bytes
    const seg2 = makeTextBlob('CCCC'); // 4 bytes

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(seg0);
      if (url.endsWith('seg1.ts')) return makeResponse(seg1);
      if (url.endsWith('seg2.ts')) return makeResponse(seg2);
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = { name: 'dl-contig' } as unknown as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    const mockTsFile = {
      arrayBuffer: async () => new ArrayBuffer(12),
    } as unknown as File;
    readFile.mockResolvedValue(mockTsFile);

    // Capture segment ranges mid-download by intercepting the convert callback.
    let capturedRanges: SegmentRange[] = [];
    const convertMock: jest.MockedFunction<ConvertCallback> = jest.fn(
      async (_dirHandle: FileSystemDirectoryHandle, _id: string): Promise<ConvertResult> => {
        // Ranges should be available at this point (before cleanup).
        capturedRanges = downloader.getSegmentRanges('dl-contig');
        return { outputName: 'output.mp4', mimeType: 'video/mp4' };
      },
    );
    downloader.setConvertCallback(convertMock);

    await downloader.downloadVideo(makeM3u8Video(), 'dl-contig');

    // Verify contiguous byte ranges.
    expect(capturedRanges).toHaveLength(3);
    expect(capturedRanges[0]).toEqual({
      index: 0,
      startByte: 0,
      endByte: 4,
      size: 4,
      duration: 10.0,
    });
    expect(capturedRanges[1]).toEqual({
      index: 1,
      startByte: 4,
      endByte: 8,
      size: 4,
      duration: 10.0,
    });
    expect(capturedRanges[2]).toEqual({
      index: 2,
      startByte: 8,
      endByte: 12,
      size: 4,
      duration: 10.0,
    });

    // Sum of sizes = total
    const totalSize = capturedRanges.reduce((sum, r) => sum + r.size, 0);
    expect(totalSize).toBe(12);

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });
  test('downloadVideo with m3u8 master playlist picks first variant, fetches, saves as .ts', async () => {
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
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/playlist.m3u8', {
      credentials: 'same-origin',
      headers: buildFetchHeaders('https://example.com'),
    });
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('HLS_Video.ts');
  });

  // 3b. Playlist with 0 segments throws error instead of saving 0-byte file
  test('downloadVideo with m3u8 with 0 segments throws error', async () => {
    const emptyPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-ENDLIST';
    const emptyBlob = makeTextBlob(emptyPlaylist);

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(emptyBlob);
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(downloader.downloadVideo(makeM3u8Video(), 'dl-empty')).rejects.toThrow(
      'No segments found in playlist',
    );
    expect(chromeDownloadsDownloadMock).not.toHaveBeenCalled();
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
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/sub.ass', {
      credentials: 'same-origin',
    });
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('sub.en.srt');
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
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/sub.vtt', {
      credentials: 'same-origin',
    });
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('sub.en.srt');
  });

  // 6. subtitle .srt (strips leftover VTT/HTML inline tags)
  test('downloadSubtitle with .srt fetches and strips VTT/HTML tags', async () => {
    const srtContent = [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      '{\\an8}<i>Hello</i>',
      '',
      '2',
      '00:00:03,000 --> 00:00:04,000',
      '<b>World</b>',
      '',
    ].join('\n');
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
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/sub.srt', {
      credentials: 'same-origin',
    });
    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('sub.en.srt');

    // Verify tags are stripped but blank lines preserved.
    const dataUrl = opts.url as string;
    const base64 = dataUrl.split(',')[1];
    const decoded = atob(base64);
    expect(decoded).not.toContain('{\\an8}');
    expect(decoded).not.toContain('<i>');
    expect(decoded).not.toContain('</i>');
    expect(decoded).not.toContain('<b>');
    expect(decoded).not.toContain('</b>');
    expect(decoded).toContain('Hello');
    expect(decoded).toContain('World');
    // Blank lines between cues preserved.
    expect(decoded).toContain('\n\n');
  });

  // 6a. subtitle with videoTitle + videoTabUrl → uses video base + lang suffix
  test('downloadSubtitle with videoTitle uses video base name + language suffix', async () => {
    fetchMock.mockResolvedValue(makeResponse(makeTextBlob('1\n00:00:01,000 --> 00:00:02,000\nHi\n')));

    const sub: DetectedSubtitle = {
      id: 's1',
      url: 'https://cdn.example.com/sub_en.srt',
      format: 'srt',
      language: 'en',
      tabId: 1,
      detectedAt: 0,
    };

    await downloader.downloadSubtitle(sub, 'dl6a', {
      videoTitle: 'See You at Work Tomorrow!',
      videoTabUrl: 'https://themoviebox.org/movies/see-you-at-work-tomorrow',
    });

    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    // Video title is meaningful → uses title as base + .en.srt
    expect(opts.filename).toBe('See_You_at_Work_Tomorrow!.en.srt');
  });

  // 6b. subtitle with videoTitle but generic title → falls back to video URL base
  test('downloadSubtitle with generic videoTitle falls back to video URL base', async () => {
    fetchMock.mockResolvedValue(makeResponse(makeTextBlob('1\n00:00:01,000 --> 00:00:02,000\nHi\n')));

    const sub: DetectedSubtitle = {
      id: 's1',
      url: 'https://cdn.example.com/sub_ar.srt',
      format: 'srt',
      language: 'ar',
      tabId: 1,
      detectedAt: 0,
    };

    await downloader.downloadSubtitle(sub, 'dl6b', {
      videoTitle: 'video', // generic → not meaningful
      videoTabUrl: 'https://kisskh.co/Drama/My-Show/Episode-1?id=1',
    });

    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    // Generic title → URL base of video tabUrl + .ar.srt
    // beautifyUrlFilename: Drama/My-Show/Episode-1 → "Drama - My Show - Episode 1"
    // sanitizeFileName: spaces → _ → "Drama_-_My_Show_-_Episode_1"
    expect(opts.filename).toBe('Drama_-_My_Show_-_Episode_1.ar.srt');
  });

  // 6c. subtitle without videoTitle → URL base of subtitle + lang suffix
  test('downloadSubtitle without videoTitle uses subtitle URL base + lang suffix', async () => {
    fetchMock.mockResolvedValue(makeResponse(makeTextBlob('1\n00:00:01,000 --> 00:00:02,000\nHi\n')));

    const sub: DetectedSubtitle = {
      id: 's1',
      url: 'https://example.com/sub_fr.srt',
      format: 'srt',
      language: 'fr',
      tabId: 1,
      detectedAt: 0,
    };

    await downloader.downloadSubtitle(sub, 'dl6c');

    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('sub_fr.fr.srt');
  });

  // 6d. subtitle with empty language → no suffix
  test('downloadSubtitle with empty language has no suffix', async () => {
    fetchMock.mockResolvedValue(makeResponse(makeTextBlob('1\n00:00:01,000 --> 00:00:02,000\nHi\n')));

    const sub: DetectedSubtitle = {
      id: 's1',
      url: 'https://example.com/sub.srt',
      format: 'srt',
      language: '',
      tabId: 1,
      detectedAt: 0,
    };

    await downloader.downloadSubtitle(sub, 'dl6d', {
      videoTitle: 'My Movie',
      videoTabUrl: 'https://example.com/movie',
    });

    expect(chromeDownloadsDownloadMock).toHaveBeenCalledTimes(1);
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('My_Movie.srt');
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
    // Segment fetches use 'same-origin' (not 'include') to avoid CORS issues
    // on cross-origin CDNs that don't send Access-Control-Allow-Credentials.
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/seg.ts', {
      signal: expect.any(AbortSignal),
      credentials: 'same-origin',
      headers: undefined,
    });
  });

  // 8. fetchSegment with tabUrl sends Referer/Origin headers
  test('fetchSegment with tabUrl sends Referer and Origin headers', async () => {
    const goodBlob = makeTextBlob('ok');
    fetchMock.mockResolvedValue(makeResponse(goodBlob));

    await downloader.fetchSegment('https://example.com/seg.ts', 'https://themoviebox.org/movies/avatar');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/seg.ts', {
      signal: expect.any(AbortSignal),
      credentials: 'same-origin',
      headers: {
        Referer: 'https://themoviebox.org/movies/avatar',
        Origin: 'https://themoviebox.org',
      },
    });
  });

  // 9. fetchSegment times out after SEGMENT_TIMEOUT_MS
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

  // 11. convertMode 'never' saves .ts even when convertCallback is set
  test('convertMode "never" saves .ts even with convertCallback set', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

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

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    const mockTsFile = {
      arrayBuffer: async () => new ArrayBuffer(9),
    } as unknown as File;
    readFile.mockResolvedValue(mockTsFile);

    const convertMock: jest.MockedFunction<ConvertCallback> = jest.fn();
    downloader.setConvertCallback(convertMock);
    downloader.setConvertMode('never');

    await downloader.downloadVideo(makeM3u8Video(), 'dl-never');

    // Convert callback should NOT be called
    expect(convertMock).not.toHaveBeenCalled();
    // Should save as .ts
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('HLS_Video.ts');

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 12. convertMode 'small-only' skips conversion for large files
  test('convertMode "small-only" skips conversion when total exceeds threshold', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    // Create segments that exceed MAX_CONVERT_BYTES (150MB)
    // Use small mock blobs but mock the arrayBuffer to report large sizes
    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    const bigBuffer = new ArrayBuffer(160 * 1024 * 1024); // 160MB > 150MB threshold
    const bigBlob = { size: 160 * 1024 * 1024, arrayBuffer: async () => bigBuffer, type: 'video/mp2t' } as unknown as Blob;
    const makeBigResponse = (blob: Blob): Response =>
      ({
        ok: true,
        status: 200,
        blob: async () => blob,
        text: async () => MEDIA_PLAYLIST,
        arrayBuffer: async () => bigBuffer,
        headers: new Headers(),
        redirected: false,
        statusText: '',
        trailer: Promise.resolve(new Headers()),
        type: 'basic',
        url: '',
        clone: function () { return makeBigResponse(blob); },
      }) as unknown as Response;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeBigResponse(bigBlob);
      if (url.endsWith('seg1.ts')) return makeBigResponse(bigBlob);
      if (url.endsWith('seg2.ts')) return makeBigResponse(bigBlob);
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    const mockTsFile = {
      arrayBuffer: async () => new ArrayBuffer(100),
    } as unknown as File;
    readFile.mockResolvedValue(mockTsFile);

    const convertMock: jest.MockedFunction<ConvertCallback> = jest.fn();
    downloader.setConvertCallback(convertMock);
    downloader.setConvertMode('small-only');

    await downloader.downloadVideo(makeM3u8Video(), 'dl-large');

    // Convert callback should NOT be called (total > 150MB)
    expect(convertMock).not.toHaveBeenCalled();
    // Should save as .ts
    const opts = chromeDownloadsDownloadMock.mock.calls[0][0];
    expect(opts.filename).toBe('HLS_Video.ts');

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 13. Segments are written to OPFS in playlist order even if network
  // resolves out of order (parallel fetch).
  test('parallel fetch writes segments in playlist order regardless of network resolution order', async () => {
    // This test uses real setTimeout delays to simulate out-of-order network
    // resolution, so we need real timers (not the fake timers from beforeEach).
    jest.useRealTimers();
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);

    // Mock fetch so segments resolve out of order: seg1 first, seg0 last.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) {
        // Delay seg0 so it resolves after seg1 and seg2.
        await new Promise((r) => setTimeout(r, 50));
        return makeResponse(makeTextBlob('seg0'));
      }
      if (url.endsWith('seg1.ts')) {
        return makeResponse(makeTextBlob('seg1'));
      }
      if (url.endsWith('seg2.ts')) {
        await new Promise((r) => setTimeout(r, 20));
        return makeResponse(makeTextBlob('seg2'));
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    const mockTsFile = {
      arrayBuffer: async () => new ArrayBuffer(15),
    } as unknown as File;
    readFile.mockResolvedValue(mockTsFile);

    // No convert callback → saves .ts directly.
    await downloader.downloadVideo(makeM3u8Video(), 'dl-order');

    // Writer should have been called 3 times (3 segments).
    expect(mockWriter.write).toHaveBeenCalledTimes(3);
    // Writer should have been closed exactly once.
    expect(mockWriter.close).toHaveBeenCalledTimes(1);

    // Verify write order: the Blob content must be seg0, seg1, seg2
    // (playlist order), NOT seg1, seg2, seg0 (network resolution order).
    const writeCalls = mockWriter.write.mock.calls;
    const writtenContents = await Promise.all(
      writeCalls.map(async (call: unknown[]) => {
        const blob = call[0] as Blob;
        return blob.text();
      }),
    );
    expect(writtenContents).toEqual(['seg0', 'seg1', 'seg2']);

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 14. Writer is closed even when a segment fetch fails.
  test('writer is closed on fetch error', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(makeTextBlob('seg0'));
      if (url.endsWith('seg1.ts')) throw new Error('Network error on seg1');
      if (url.endsWith('seg2.ts')) return makeResponse(makeTextBlob('seg2'));
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    await expect(downloader.downloadVideo(makeM3u8Video(), 'dl-err')).rejects.toThrow();

    // Writer must have been closed despite the error (via finally block).
    expect(mockWriter.close).toHaveBeenCalledTimes(1);

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 15. When saveOpfsFileCallback is set, the downloader saves via that
  // callback and does NOT call opfsReadFile().arrayBuffer() — avoiding the
  // ~1.4GB memory spike on a 430MB file.
  test('saveOpfsFileCallback is used and arrayBuffer() is not called on save path', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(makeTextBlob('seg0'));
      if (url.endsWith('seg1.ts')) return makeResponse(makeTextBlob('seg1'));
      if (url.endsWith('seg2.ts')) return makeResponse(makeTextBlob('seg2'));
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    // readFile should NOT be called on the save path when the callback is set.
    const arrayBufferSpy = jest.fn(async () => new ArrayBuffer(9));
    readFile.mockResolvedValue({
      arrayBuffer: arrayBufferSpy,
    } as unknown as File);

    // Wire the saveOpfsFileCallback — captures the args and does NOT
    // materialize the file.
    const saveOpfsFileCalls: Array<{
      downloadId: string;
      opfsFilename: string;
      downloadFilename: string;
      mimeType: string;
    }> = [];
    downloader.setSaveOpfsFileCallback(
      async (downloadId, opfsFilename, downloadFilename, mimeType) => {
        saveOpfsFileCalls.push({
          downloadId,
          opfsFilename,
          downloadFilename,
          mimeType,
        });
      },
    );

    // No convert callback → saves .ts directly via saveOpfsFile.
    await downloader.downloadVideo(makeM3u8Video(), 'dl-saveopfs');

    // saveOpfsFileCallback called once with the .ts file.
    expect(saveOpfsFileCalls).toHaveLength(1);
    expect(saveOpfsFileCalls[0]).toEqual({
      downloadId: 'dl-saveopfs',
      opfsFilename: 'input.ts',
      downloadFilename: 'HLS_Video.ts',
      mimeType: 'video/mp2t',
    });

    // readFile was NOT called on the save path (no arrayBuffer materialization).
    expect(readFile).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();

    // chrome.downloads.download was NOT called directly — the callback owns
    // that responsibility.
    expect(chromeDownloadsDownloadMock).not.toHaveBeenCalled();

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 16. When conversion succeeds and saveOpfsFileCallback is set, the
  // downloader saves the .mp4 via the callback (not data URL).
  test('saveOpfsFileCallback saves converted mp4 without arrayBuffer()', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(makeTextBlob('seg0'));
      if (url.endsWith('seg1.ts')) return makeResponse(makeTextBlob('seg1'));
      if (url.endsWith('seg2.ts')) return makeResponse(makeTextBlob('seg2'));
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);
    readFile.mockResolvedValue({
      arrayBuffer: jest.fn(async () => new ArrayBuffer(42)),
    } as unknown as File);

    const convertMock: jest.MockedFunction<ConvertCallback> = jest.fn(
      async (
        _dirHandle: FileSystemDirectoryHandle,
        _downloadId: string,
      ): Promise<ConvertResult> => ({
        outputName: 'output.mp4',
        mimeType: 'video/mp4',
      }),
    );
    downloader.setConvertCallback(convertMock);

    const saveOpfsFileCalls: Array<{
      downloadId: string;
      opfsFilename: string;
      downloadFilename: string;
      mimeType: string;
    }> = [];
    downloader.setSaveOpfsFileCallback(
      async (downloadId, opfsFilename, downloadFilename, mimeType) => {
        saveOpfsFileCalls.push({
          downloadId,
          opfsFilename,
          downloadFilename,
          mimeType,
        });
      },
    );

    await downloader.downloadVideo(makeM3u8Video(), 'dl-mp4-saveopfs');

    expect(convertMock).toHaveBeenCalledTimes(1);
    expect(saveOpfsFileCalls).toHaveLength(1);
    expect(saveOpfsFileCalls[0]).toEqual({
      downloadId: 'dl-mp4-saveopfs',
      opfsFilename: 'output.mp4',
      downloadFilename: 'HLS_Video.mp4',
      mimeType: 'video/mp4',
    });
    // readFile was NOT called on the save path.
    expect(readFile).not.toHaveBeenCalled();
    expect(chromeDownloadsDownloadMock).not.toHaveBeenCalled();

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 17. When conversion fails and saveOpfsFileCallback is set, the fallback
  // .ts is saved via the callback (not data URL), so the fallback path is
  // also memory-safe.
  test('conversion failure with saveOpfsFileCallback saves .ts fallback without arrayBuffer()', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(makeTextBlob('seg0'));
      if (url.endsWith('seg1.ts')) return makeResponse(makeTextBlob('seg1'));
      if (url.endsWith('seg2.ts')) return makeResponse(makeTextBlob('seg2'));
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, readFile, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        readFile: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    mockWriter.write.mockClear();
    mockWriter.close.mockClear();
    createOpfsWriter.mockResolvedValue(mockWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);
    readFile.mockResolvedValue({
      arrayBuffer: jest.fn(async () => new ArrayBuffer(9)),
    } as unknown as File);

    // Convert callback that throws → triggers .ts fallback.
    const convertMock: jest.MockedFunction<ConvertCallback> = jest.fn(
      async (
        _dirHandle: FileSystemDirectoryHandle,
        _downloadId: string,
      ): Promise<ConvertResult> => {
        throw new Error('transmux failed');
      },
    );
    downloader.setConvertCallback(convertMock);

    const saveOpfsFileCalls: Array<{
      downloadId: string;
      opfsFilename: string;
      downloadFilename: string;
      mimeType: string;
    }> = [];
    downloader.setSaveOpfsFileCallback(
      async (downloadId, opfsFilename, downloadFilename, mimeType) => {
        saveOpfsFileCalls.push({
          downloadId,
          opfsFilename,
          downloadFilename,
          mimeType,
        });
      },
    );

    await downloader.downloadVideo(makeM3u8Video(), 'dl-fallback-saveopfs');

    expect(convertMock).toHaveBeenCalledTimes(1);
    // Fallback saved .ts via the callback.
    expect(saveOpfsFileCalls).toHaveLength(1);
    expect(saveOpfsFileCalls[0]).toEqual({
      downloadId: 'dl-fallback-saveopfs',
      opfsFilename: 'input.ts',
      downloadFilename: 'HLS_Video.ts',
      mimeType: 'video/mp2t',
    });
    // readFile was NOT called on the save path.
    expect(readFile).not.toHaveBeenCalled();
    expect(chromeDownloadsDownloadMock).not.toHaveBeenCalled();

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // 18. OPFS quota exceeded during segment write → clear error + cleanup.
  test('quota exceeded during write throws clear error and cleans up OPFS', async () => {
    (isOpfsAvailable as jest.Mock).mockReturnValue(true);

    const playlistBlob = makeTextBlob(MEDIA_PLAYLIST);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('playlist.m3u8')) return makeResponse(playlistBlob);
      if (url.endsWith('seg0.ts')) return makeResponse(makeTextBlob('seg0'));
      if (url.endsWith('seg1.ts')) return makeResponse(makeTextBlob('seg1'));
      if (url.endsWith('seg2.ts')) return makeResponse(makeTextBlob('seg2'));
      throw new Error(`unexpected fetch ${url}`);
    });

    const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
      require('@/shared/lib/storage/opfsStorage') as {
        ensureDownloadSubdir: jest.Mock;
        createOpfsWriter: jest.Mock;
        deleteDownloadSubdir: jest.Mock;
      };

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    ensureDownloadSubdir.mockResolvedValue(mockDirHandle);
    // Writer.write throws QuotaExceededError on the first write.
    const quotaWriter = {
      write: jest.fn().mockRejectedValue(
        new DOMException('Quota exceeded', 'QuotaExceededError'),
      ),
      close: jest.fn().mockResolvedValue(undefined),
    };
    createOpfsWriter.mockResolvedValue(quotaWriter);
    deleteDownloadSubdir.mockResolvedValue(undefined);

    await expect(
      downloader.downloadVideo(makeM3u8Video(), 'dl-quota'),
    ).rejects.toThrow(/đủ dung lượng/i);

    // OPFS cleanup should have been called.
    expect(deleteDownloadSubdir).toHaveBeenCalledWith('dl-quota');

    (isOpfsAvailable as jest.Mock).mockReturnValue(false);
  });

  // ============================================================
  // T4-T5: AES-128 Decryption
  // ============================================================
  describe('AES-128 decryption', () => {
    beforeEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(true);
    });
    afterEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(false);
    });

    it('fetchKey fetches a 16-byte key and caches it', async () => {
      const keyBytes = new Uint8Array(16).fill(0xAB);
      const keyBuf = keyBytes.buffer.slice(0);
      fetchMock.mockImplementation(async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u === 'https://cdn.example.com/key.bin') {
          return makeResponse(makeBlob(new Uint8Array(keyBuf), 'application/octet-stream'), true, 200);
        }
        throw new Error(`unexpected fetch ${u}`);
      });

      const key1 = await downloader.fetchKey('https://cdn.example.com/key.bin', 'https://example.com');
      expect(key1).toBeDefined();
      // Second call should use cache (no additional fetch)
      const fetchCountBefore = fetchMock.mock.calls.length;
      const key2 = await downloader.fetchKey('https://cdn.example.com/key.bin', 'https://example.com');
      expect(fetchMock.mock.calls.length).toBe(fetchCountBefore);
      expect(key2).toBe(key1);
    });

    it('fetchKey throws on non-16-byte key', async () => {
      fetchMock.mockImplementation(async () =>
        makeResponse(makeBlob(new Uint8Array(10), 'application/octet-stream'), true, 200),
      );
      await expect(
        downloader.fetchKey('https://cdn.example.com/badkey.bin', 'https://example.com'),
      ).rejects.toThrow(/16 bytes/);
    });

    it('fetchKey throws on HTTP error', async () => {
      fetchMock.mockImplementation(async () =>
        makeResponse(makeTextBlob('Forbidden'), false, 403),
      );
      await expect(
        downloader.fetchKey('https://cdn.example.com/forbidden.bin', 'https://example.com'),
      ).rejects.toThrow(/403/);
    });

    it('decryptSegment decrypts AES-128-CBC with playlist IV', async () => {
      // Generate a real key + IV + ciphertext using WebCrypto.
      const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(16).fill(0x42),
        { name: 'AES-CBC' },
        false,
        ['encrypt', 'decrypt'],
      );
      const iv = new Uint8Array(16).fill(0x11);
      const plaintext = new Uint8Array(32);
      for (let i = 0; i < 32; i++) plaintext[i] = i;
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintext);
      const encBlob = new Blob([ciphertext], { type: 'application/octet-stream' });

      const decrypted = await downloader.decryptSegment(
        encBlob,
        key,
        { method: 'AES-128', keyUri: 'https://cdn.example.com/key.bin', iv: '0x' + Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('') },
        0,
      );
      const decData = new Uint8Array(await decrypted.arrayBuffer());
      expect(decData).toEqual(plaintext);
    });

    it('decryptSegment derives IV from sequence when IV absent', async () => {
      const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(16).fill(0x99),
        { name: 'AES-CBC' },
        false,
        ['encrypt', 'decrypt'],
      );
      // Derive IV for sequence 5
      const iv = new Uint8Array(16);
      const view = new DataView(iv.buffer);
      view.setUint32(12, 0);
      view.setUint32(8, 5);
      const plaintext = new Uint8Array(16).fill(0xFF);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintext);
      const encBlob = new Blob([ciphertext], { type: 'application/octet-stream' });

      const decrypted = await downloader.decryptSegment(
        encBlob,
        key,
        { method: 'AES-128', keyUri: 'https://cdn.example.com/key.bin' },
        5,
      );
      const decData = new Uint8Array(await decrypted.arrayBuffer());
      expect(decData).toEqual(plaintext);
    });

    it('downloadM3u8Video decrypts encrypted segments end-to-end', async () => {
      // Setup: encrypted playlist with 2 segments.
      const keyBytes = new Uint8Array(16).fill(0x42);
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC' },
        false,
        ['encrypt', 'decrypt'],
      );
      const iv0 = new Uint8Array(16);
      const iv1 = new Uint8Array(16);
      new DataView(iv1.buffer).setUint32(8, 1);
      const seg0Plain = new Uint8Array(16).fill(0xAA);
      const seg1Plain = new Uint8Array(16).fill(0xBB);
      const seg0Cipher = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv0 }, key, seg0Plain);
      const seg1Cipher = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv1 }, key, seg1Plain);

      const encPlaylist = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:10',
        '#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/key.bin"',
        '#EXTINF:10.0,',
        'https://cdn.example.com/seg0.ts',
        '#EXTINF:10.0,',
        'https://cdn.example.com/seg1.ts',
        '#EXT-X-ENDLIST',
      ].join('\n');

      fetchMock.mockImplementation(async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u === 'https://example.com/playlist.m3u8') {
          return makeResponse(makeTextBlob(encPlaylist), true, 200);
        }
        if (u === 'https://cdn.example.com/key.bin') {
          return makeResponse(makeBlob(keyBytes, 'application/octet-stream'), true, 200);
        }
        if (u === 'https://cdn.example.com/seg0.ts') {
          return makeResponse(makeBlob(new Uint8Array(seg0Cipher), 'video/mp2t'), true, 200);
        }
        if (u === 'https://cdn.example.com/seg1.ts') {
          return makeResponse(makeBlob(new Uint8Array(seg1Cipher), 'video/mp2t'), true, 200);
        }
        throw new Error(`unexpected fetch ${u}`);
      });

      const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
        require('@/shared/lib/storage/opfsStorage') as {
          ensureDownloadSubdir: jest.Mock;
          createOpfsWriter: jest.Mock;
          deleteDownloadSubdir: jest.Mock;
        };
      ensureDownloadSubdir.mockResolvedValue({} as FileSystemDirectoryHandle);
      mockWriter.write.mockClear();
      mockWriter.close.mockClear();
      createOpfsWriter.mockResolvedValue(mockWriter);
      deleteDownloadSubdir.mockResolvedValue(undefined);

      // No convert callback — should save .ts
      await downloader.downloadVideo(makeM3u8Video(), 'dl-aes');

      // Verify 2 segments were written (decrypted)
      expect(mockWriter.write).toHaveBeenCalledTimes(2);
      // Verify the decrypted data matches plaintext
      const w0 = mockWriter.write.mock.calls[0][0] as Blob;
      const w1 = mockWriter.write.mock.calls[1][0] as Blob;
      const d0 = new Uint8Array(await w0.arrayBuffer());
      const d1 = new Uint8Array(await w1.arrayBuffer());
      expect(d0).toEqual(seg0Plain);
      expect(d1).toEqual(seg1Plain);
    });
  });

  // ============================================================
  // T6: fMP4 / CMAF concat path
  // ============================================================
  describe('fMP4 concat path', () => {
    beforeEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(true);
    });
    afterEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(false);
    });

    it('downloadM3u8Video fetches init segment + .m4s segments and saves as .mp4', async () => {
      const fmp4Playlist = [
        '#EXTM3U',
        '#EXT-X-VERSION:6',
        '#EXT-X-TARGETDURATION:10',
        '#EXT-X-MAP:URI="https://cdn.example.com/init.mp4"',
        '#EXTINF:10.0,',
        'https://cdn.example.com/seg0.m4s',
        '#EXTINF:10.0,',
        'https://cdn.example.com/seg1.m4s',
        '#EXT-X-ENDLIST',
      ].join('\n');

      const initData = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]); // ftyp box
      const seg0Data = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x6D, 0x6F, 0x6F, 0x76]); // moof box
      const seg1Data = new Uint8Array([0x00, 0x00, 0x00, 0x1C, 0x6D, 0x64, 0x61, 0x74]); // mdat box

      fetchMock.mockImplementation(async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u === 'https://example.com/playlist.m3u8') {
          return makeResponse(makeTextBlob(fmp4Playlist), true, 200);
        }
        if (u === 'https://cdn.example.com/init.mp4') {
          return makeResponse(makeBlob(initData, 'video/mp4'), true, 200);
        }
        if (u === 'https://cdn.example.com/seg0.m4s') {
          return makeResponse(makeBlob(seg0Data, 'video/iso.segment'), true, 200);
        }
        if (u === 'https://cdn.example.com/seg1.m4s') {
          return makeResponse(makeBlob(seg1Data, 'video/iso.segment'), true, 200);
        }
        throw new Error(`unexpected fetch ${u}`);
      });

      const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
        require('@/shared/lib/storage/opfsStorage') as {
          ensureDownloadSubdir: jest.Mock;
          createOpfsWriter: jest.Mock;
          deleteDownloadSubdir: jest.Mock;
        };
      ensureDownloadSubdir.mockResolvedValue({} as FileSystemDirectoryHandle);
      mockWriter.write.mockClear();
      mockWriter.close.mockClear();
      createOpfsWriter.mockResolvedValue(mockWriter);
      deleteDownloadSubdir.mockResolvedValue(undefined);

      const saveOpfsFileCalls: Array<{ opfsFilename: string; downloadFilename: string; mimeType: string }> = [];
      downloader.setSaveOpfsFileCallback(async (_id, opfsFilename, downloadFilename, mimeType) => {
        saveOpfsFileCalls.push({ opfsFilename, downloadFilename, mimeType });
      });

      await downloader.downloadVideo(makeM3u8Video(), 'dl-fmp4');

      // Init segment written first (separate writer), then 2 segments in main writer
      // createOpfsWriter called twice: once for init, once for main
      expect(createOpfsWriter).toHaveBeenCalledTimes(2);
      // First call: init segment to input.mp4
      expect(createOpfsWriter.mock.calls[0][1]).toBe('input.mp4');
      // Second call: main segments to input.mp4
      expect(createOpfsWriter.mock.calls[1][1]).toBe('input.mp4');
      // Init segment + 2 segments written (same mock writer, 3 total writes)
      expect(mockWriter.write).toHaveBeenCalledTimes(3);
      // Saved as .mp4 (not .ts, no transmux)
      expect(saveOpfsFileCalls).toHaveLength(1);
      expect(saveOpfsFileCalls[0].opfsFilename).toBe('input.mp4');
      expect(saveOpfsFileCalls[0].downloadFilename).toMatch(/\.mp4$/);
      expect(saveOpfsFileCalls[0].mimeType).toBe('video/mp4');
    });

    it('fMP4 init segment fetch error throws clear error', async () => {
      const fmp4Playlist = [
        '#EXTM3U',
        '#EXT-X-VERSION:6',
        '#EXT-X-TARGETDURATION:10',
        '#EXT-X-MAP:URI="https://cdn.example.com/init.mp4"',
        '#EXTINF:10.0,',
        'https://cdn.example.com/seg0.m4s',
        '#EXT-X-ENDLIST',
      ].join('\n');

      fetchMock.mockImplementation(async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u === 'https://example.com/playlist.m3u8') {
          return makeResponse(makeTextBlob(fmp4Playlist), true, 200);
        }
        if (u === 'https://cdn.example.com/init.mp4') {
          return makeResponse(makeTextBlob('Not Found'), false, 404);
        }
        throw new Error(`unexpected fetch ${u}`);
      });

      const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
        require('@/shared/lib/storage/opfsStorage') as {
          ensureDownloadSubdir: jest.Mock;
          createOpfsWriter: jest.Mock;
          deleteDownloadSubdir: jest.Mock;
        };
      ensureDownloadSubdir.mockResolvedValue({} as FileSystemDirectoryHandle);
      createOpfsWriter.mockResolvedValue(mockWriter);
      deleteDownloadSubdir.mockResolvedValue(undefined);

      await expect(downloader.downloadVideo(makeM3u8Video(), 'dl-fmp4-fail')).rejects.toThrow();
    });
  });

  // ============================================================
  // T7: Byte-range segment fetch
  // ============================================================
  describe('byte-range fetch', () => {
    it('fetchSegmentWithRange adds Range header', async () => {
      const data = new Uint8Array(100).fill(0xCC);
      fetchMock.mockImplementation(async () =>
        makeResponse(makeBlob(data, 'video/mp2t'), true, 206),
      );

      const blob = await downloader.fetchSegmentWithRange(
        'https://cdn.example.com/segments.ts',
        'https://example.com',
        { length: 100, offset: 500 },
      );
      expect(blob.size).toBe(100);

      const call = fetchMock.mock.calls[0];
      const headers = (call[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined;
      expect(headers?.['Range']).toBe('bytes=500-599');
    });

    it('fetchSegmentWithRange accepts 206 Partial Content', async () => {
      const data = new Uint8Array(50).fill(0xDD);
      fetchMock.mockImplementation(async () =>
        makeResponse(makeBlob(data, 'video/mp2t'), true, 206),
      );

      const blob = await downloader.fetchSegmentWithRange(
        'https://cdn.example.com/segments.ts',
        undefined,
        { length: 50, offset: 0 },
      );
      expect(blob.size).toBe(50);
    });

    it('fetchSegmentWithRange without byteRange delegates to fetchSegment', async () => {
      const data = new Uint8Array(200).fill(0xEE);
      fetchMock.mockImplementation(async () =>
        makeResponse(makeBlob(data, 'video/mp2t'), true, 200),
      );

      const blob = await downloader.fetchSegmentWithRange(
        'https://cdn.example.com/seg.ts',
        'https://example.com',
      );
      expect(blob.size).toBe(200);
      // Should NOT have Range header
      const call = fetchMock.mock.calls[0];
      const headers = (call[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined;
      expect(headers?.['Range']).toBeUndefined();
    });
  });

  // ============================================================
  // T8: Ad skip via DISCONTINUITY
  // ============================================================
  describe('ad skip via discontinuity', () => {
    beforeEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(true);
    });
    afterEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(false);
    });

    it('skips segments marked with discontinuity', async () => {
      const adPlaylist = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:10',
        '#EXTINF:10.0,',
        'https://cdn.example.com/content0.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:5.0,',
        'https://cdn.example.com/ad0.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:10.0,',
        'https://cdn.example.com/content1.ts',
        '#EXT-X-ENDLIST',
      ].join('\n');

      fetchMock.mockImplementation(async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u === 'https://example.com/playlist.m3u8') {
          return makeResponse(makeTextBlob(adPlaylist), true, 200);
        }
        if (u === 'https://cdn.example.com/content0.ts') {
          return makeResponse(makeBlob(new Uint8Array(100).fill(0xC0), 'video/mp2t'), true, 200);
        }
        if (u === 'https://cdn.example.com/content1.ts') {
          return makeResponse(makeBlob(new Uint8Array(100).fill(0xC1), 'video/mp2t'), true, 200);
        }
        if (u === 'https://cdn.example.com/ad0.ts') {
          return makeResponse(makeBlob(new Uint8Array(50).fill(0xAD), 'video/mp2t'), true, 200);
        }
        throw new Error(`unexpected fetch ${u}`);
      });

      const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
        require('@/shared/lib/storage/opfsStorage') as {
          ensureDownloadSubdir: jest.Mock;
          createOpfsWriter: jest.Mock;
          deleteDownloadSubdir: jest.Mock;
        };
      ensureDownloadSubdir.mockResolvedValue({} as FileSystemDirectoryHandle);
      mockWriter.write.mockClear();
      mockWriter.close.mockClear();
      createOpfsWriter.mockResolvedValue(mockWriter);
      deleteDownloadSubdir.mockResolvedValue(undefined);

      await downloader.downloadVideo(makeM3u8Video(), 'dl-ads');

      // Only 2 content segments written (ad0 skipped)
      expect(mockWriter.write).toHaveBeenCalledTimes(2);
      // Verify ad segment was NOT fetched
      const fetchedUrls = fetchMock.mock.calls.map(c => c[0] as string);
      expect(fetchedUrls).not.toContain('https://cdn.example.com/ad0.ts');
    });

    it('throws when all segments are in ad breaks (no content)', async () => {
      // Section 0: empty (no segments before first DISCONTINUITY)
      // Section 1: ad0.ts (ad — odd section)
      const allAdPlaylist = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:10',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:5.0,',
        'https://cdn.example.com/ad0.ts',
        '#EXT-X-ENDLIST',
      ].join('\n');

      fetchMock.mockImplementation(async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u === 'https://example.com/playlist.m3u8') {
          return makeResponse(makeTextBlob(allAdPlaylist), true, 200);
        }
        throw new Error(`unexpected fetch ${u}`);
      });

      const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
        require('@/shared/lib/storage/opfsStorage') as {
          ensureDownloadSubdir: jest.Mock;
          createOpfsWriter: jest.Mock;
          deleteDownloadSubdir: jest.Mock;
        };
      ensureDownloadSubdir.mockResolvedValue({} as FileSystemDirectoryHandle);
      createOpfsWriter.mockResolvedValue(mockWriter);
      deleteDownloadSubdir.mockResolvedValue(undefined);

      await expect(downloader.downloadVideo(makeM3u8Video(), 'dl-all-ads')).rejects.toThrow(/discontinuity|content/i);
    });
  });

  // ============================================================
  // T9: Nested master playlist
  // ============================================================
  describe('nested master playlist', () => {
    beforeEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(true);
    });
    afterEach(() => {
      (isOpfsAvailable as jest.Mock).mockReturnValue(false);
    });

    it('handles nested master (master → master → media)', async () => {
      const nestedMaster = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=1000000',
        'https://cdn.example.com/sub-master.m3u8',
      ].join('\n');

      const subMaster = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=500000',
        'https://cdn.example.com/media.m3u8',
      ].join('\n');

      const mediaPlaylist = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:10',
        '#EXTINF:10.0,',
        'https://cdn.example.com/seg0.ts',
        '#EXT-X-ENDLIST',
      ].join('\n');

      fetchMock.mockImplementation(async (url: string | URL | Request) => {
        const u = typeof url === 'string' ? url : url.toString();
        if (u === 'https://example.com/playlist.m3u8') return makeResponse(makeTextBlob(nestedMaster), true, 200);
        if (u === 'https://cdn.example.com/sub-master.m3u8') return makeResponse(makeTextBlob(subMaster), true, 200);
        if (u === 'https://cdn.example.com/media.m3u8') return makeResponse(makeTextBlob(mediaPlaylist), true, 200);
        if (u === 'https://cdn.example.com/seg0.ts') return makeResponse(makeBlob(new Uint8Array(100).fill(0x01), 'video/mp2t'), true, 200);
        throw new Error(`unexpected fetch ${u}`);
      });

      const { ensureDownloadSubdir, createOpfsWriter, deleteDownloadSubdir } =
        require('@/shared/lib/storage/opfsStorage') as {
          ensureDownloadSubdir: jest.Mock;
          createOpfsWriter: jest.Mock;
          deleteDownloadSubdir: jest.Mock;
        };
      ensureDownloadSubdir.mockResolvedValue({} as FileSystemDirectoryHandle);
      mockWriter.write.mockClear();
      mockWriter.close.mockClear();
      createOpfsWriter.mockResolvedValue(mockWriter);
      deleteDownloadSubdir.mockResolvedValue(undefined);

      await downloader.downloadVideo(makeM3u8Video(), 'dl-nested');

      // 1 segment written
      expect(mockWriter.write).toHaveBeenCalledTimes(1);
    });
  });
});
