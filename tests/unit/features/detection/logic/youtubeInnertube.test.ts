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
  it('builds an ANDROID client context', () => {
    const ctx = buildInnerTubeContext('20.10.38');
    expect(ctx.clientName).toBe('ANDROID');
    expect(ctx.clientVersion).toBe('20.10.38');
  });

  it('builds an ANDROID client context with visitorData', () => {
    const ctx = buildInnerTubeContext('20.10.38', 'visitor-123');
    expect(ctx.clientName).toBe('ANDROID');
    expect(ctx.clientVersion).toBe('20.10.38');
    expect(ctx.visitorData).toBe('visitor-123');
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

  it('sends a POST with ANDROID client context and the API key in the URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
    global.fetch = fetchMock;

    await fetchCaptionTracksViaInnerTube('vid', 'apikey', 'visitor-data-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('key=apikey');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.context.client.clientName).toBe('ANDROID');
    expect(body.context.client.clientVersion).toBe('20.10.38');
    expect(body.context.client.visitorData).toBe('visitor-data-123');
    expect(body.videoId).toBe('vid');
  });

  it('sends ANDROID client context without visitorData when not provided', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
    global.fetch = fetchMock;

    await fetchCaptionTracksViaInnerTube('vid', 'apikey');

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.context.client.clientName).toBe('ANDROID');
    expect(body.context.client.visitorData).toBeUndefined();
  });
});
