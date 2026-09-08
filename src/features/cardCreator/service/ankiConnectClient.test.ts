import {
  invokeAnkiConnect,
  getVersion,
  addNote,
  AnkiConnectError,
  type FetchFn,
} from './ankiConnectClient';

/** Build a mock fetch that returns a fixed JSON response. */
function mockFetch(response: { ok: boolean; status: number; body: unknown }): FetchFn {
  return async () => ({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  });
}

/** Build a mock fetch that inspects the request body (for asserting action/params). */
function mockFetchInspecting(
  body: unknown,
  inspect: (req: { url: string; body: string; method?: string; headers?: Record<string, string> }) => void,
): FetchFn {
  return async (url, init) => {
    inspect({ url, body: init?.body ?? '', method: init?.method, headers: init?.headers });
    return { ok: true, status: 200, json: async () => body };
  };
}

describe('ankiConnectClient', () => {
  describe('invokeAnkiConnect', () => {
    it('returns result on success', async () => {
      const fetchFn = mockFetch({ ok: true, status: 200, body: { result: 6, error: null } });
      const result = await invokeAnkiConnect(fetchFn, 'http://localhost:8765', 'version');
      expect(result).toBe(6);
    });

    it('throws AnkiConnectError when AnkiConnect returns error field', async () => {
      const fetchFn = mockFetch({
        ok: true,
        status: 200,
        body: { result: null, error: 'model not found' },
      });
      await expect(
        invokeAnkiConnect(fetchFn, 'http://localhost:8765', 'modelFieldNames'),
      ).rejects.toThrow(AnkiConnectError);
      await expect(
        invokeAnkiConnect(fetchFn, 'http://localhost:8765', 'modelFieldNames'),
      ).rejects.toThrow('model not found');
    });

    it('throws AnkiConnectError on HTTP non-2xx', async () => {
      const fetchFn = mockFetch({ ok: false, status: 500, body: {} });
      await expect(
        invokeAnkiConnect(fetchFn, 'http://localhost:8765', 'version'),
      ).rejects.toThrow('HTTP 500');
    });

    it('throws AnkiConnectError on network failure', async () => {
      const fetchFn: FetchFn = async () => {
        throw new Error('connection refused');
      };
      await expect(
        invokeAnkiConnect(fetchFn, 'http://localhost:8765', 'version'),
      ).rejects.toThrow('Network error: connection refused');
    });

    it('throws AnkiConnectError when baseUrl is empty', async () => {
      const fetchFn = mockFetch({ ok: true, status: 200, body: { result: 6, error: null } });
      await expect(invokeAnkiConnect(fetchFn, '', 'version')).rejects.toThrow(
        'AnkiConnect URL is empty',
      );
    });

    it('sends POST with version 6 + action + params and text/plain to avoid preflight', async () => {
      let captured: { url: string; body: string; method?: string; headers?: Record<string, string> } | null = null;
      const fetchFn = mockFetchInspecting({ result: null, error: null }, (req) => {
        captured = req;
      });
      await invokeAnkiConnect(fetchFn, 'http://localhost:8765', 'addNote', {
        note: { deckName: 'Default', modelName: 'Basic', fields: {} },
      });
      expect(captured).not.toBeNull();
      expect(captured!.url).toBe('http://localhost:8765');
      expect(captured!.method).toBe('POST');
      expect(captured!.headers?.['Content-Type']).toBe('text/plain');
      const parsed = JSON.parse(captured!.body);
      expect(parsed.version).toBe(6);
      expect(parsed.action).toBe('addNote');
      expect(parsed.params.note.deckName).toBe('Default');
    });
  });

  describe('getVersion', () => {
    it('returns the version number', async () => {
      const fetchFn = mockFetch({ ok: true, status: 200, body: { result: 6, error: null } });
      const version = await getVersion(fetchFn, 'http://localhost:8765');
      expect(version).toBe(6);
    });
  });

  describe('addNote', () => {
    it('returns the new note id (or null if duplicate)', async () => {
      const fetchFn = mockFetch({ ok: true, status: 200, body: { result: 123456789, error: null } });
      const id = await addNote(fetchFn, 'http://localhost:8765', {
        deckName: 'Default',
        modelName: 'Basic',
        fields: { Front: 'hello', Back: 'world' },
      });
      expect(id).toBe(123456789);
    });
  });
});
