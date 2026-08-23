import { downloadVoicePack, isVoicePackDownloaded, deleteVoicePack } from './ttsDownloadManager';

const mockWriteTtsFile = jest.fn().mockImplementation(
  (_name: string, _stream: unknown, onChunk?: (bytes: number) => void) => {
    onChunk?.(100);
    return Promise.resolve(undefined);
  },
);
const mockHasTtsFile = jest.fn().mockResolvedValue(false);
const mockDeleteTtsFile = jest.fn().mockResolvedValue(undefined);

jest.mock('./ttsModelStorage', () => ({
  writeTtsFile: (name: string, stream: unknown, onChunk?: (bytes: number) => void) =>
    mockWriteTtsFile(name, stream, onChunk),
  hasTtsFile: (name: string) => mockHasTtsFile(name),
  deleteTtsFile: (name: string) => mockDeleteTtsFile(name),
}));

describe('ttsDownloadManager', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as Record<string, unknown>).fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return Promise.resolve({
          ok: true,
          headers: new Map([['Content-Length', '100']]) as unknown as Headers,
          status: 200,
          statusText: 'OK',
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValueOnce({ done: false, value: new Uint8Array(100) }).mockResolvedValueOnce({ done: true }),
            releaseLock: jest.fn(),
          }),
        },
        headers: new Map() as unknown as Headers,
      } as unknown as Response);
    });
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).fetch = originalFetch;
  });

  it('downloads all Supertonic ONNX files and reports progress', async () => {
    const onProgress = jest.fn();
    await downloadVoicePack('en', onProgress);

    expect((globalThis as Record<string, unknown>).fetch).toHaveBeenCalledTimes(12); // 6 HEAD + 6 GET
    expect(mockWriteTtsFile).toHaveBeenCalledTimes(6);
    expect(onProgress).toHaveBeenLastCalledWith({ loaded: 600, total: 600 });
  });

  it('reports whether all voice pack files are present', async () => {
    mockHasTtsFile.mockResolvedValue(true);
    const downloaded = await isVoicePackDownloaded();
    expect(downloaded).toBe(true);
    expect(mockHasTtsFile).toHaveBeenCalledTimes(6);
  });

  it('deletes all voice pack files', async () => {
    await deleteVoicePack();
    expect(mockDeleteTtsFile).toHaveBeenCalledTimes(6);
  });
});
