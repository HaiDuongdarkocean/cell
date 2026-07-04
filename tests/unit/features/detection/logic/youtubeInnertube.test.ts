import {
  fetchCaptionTracksViaInnerTube,
  extractInnertubeApiKey,
  extractClientVersion,
  buildInnerTubeContext,
} from '@/features/detection/logic/youtubeInnertube';

describe('extractInnertubeApiKey', () => {
  it('extracts the API key from page HTML', () => {
    const html = '<script>ytConfig = {"INNERTUBE_API_KEY":"AIzaSyABC123XYZ"}</script>';
    expect(extractInnertubeApiKey(html)).toBe('AIzaSyABC123XYZ');
  });

  it('returns null when the key is absent', () => {
    expect(extractInnertubeApiKey('<html>no key here</html>')).toBeNull();
  });

  it('handles whitespace around the colon', () => {
    const html = '"INNERTUBE_API_KEY" : "key-with-spaces"';
    expect(extractInnertubeApiKey(html)).toBe('key-with-spaces');
  });
});

describe('extractClientVersion', () => {
  it('extracts the client version from page HTML', () => {
    const html = '"clientVersion":"2.20240705.01.00"';
    expect(extractClientVersion(html)).toBe('2.20240705.01.00');
  });

  it('falls back to a default version when not found', () => {
    expect(extractClientVersion('<html>no version</html>')).toBe(
      '2.20240701.00.00',
    );
  });
});

describe('buildInnerTubeContext', () => {
  it('builds a WEB client context', () => {
    const ctx = buildInnerTubeContext('2.20240705.01.00');
    expect(ctx.clientName).toBe('WEB');
    expect(ctx.clientVersion).toBe('2.20240705.01.00');
  });
});

describe('fetchCaptionTracksViaInnerTube', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns caption tracks on a successful response', async () => {
    const mockJson = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en',
              languageCode: 'en',
            },
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=vi',
              languageCode: 'vi',
              kind: 'asr',
            },
          ],
        },
      },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJson,
    } as Response);

    const tracks = await fetchCaptionTracksViaInnerTube('abc', 'key123');
    expect(tracks).toHaveLength(2);
    expect(tracks[0].languageCode).toBe('en');
    expect(tracks[1].languageCode).toBe('vi');
  });

  it('returns [] when response has no captions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    const tracks = await fetchCaptionTracksViaInnerTube('abc', 'key123');
    expect(tracks).toEqual([]);
  });

  it('returns [] on non-OK HTTP status and warns', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    } as Response);

    const tracks = await fetchCaptionTracksViaInnerTube('abc', 'key123');
    expect(tracks).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('403'));
    warnSpy.mockRestore();
  });

  it('returns [] when fetch throws and warns', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));

    const tracks = await fetchCaptionTracksViaInnerTube('abc', 'key123');
    expect(tracks).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fetch failed'),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('sends a POST with WEB client context and the API key in the URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
    global.fetch = fetchMock;

    await fetchCaptionTracksViaInnerTube('vid', 'apikey', '2.0.0');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('key=apikey');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.context.client.clientName).toBe('WEB');
    expect(body.context.client.clientVersion).toBe('2.0.0');
    expect(body.videoId).toBe('vid');
  });
});
