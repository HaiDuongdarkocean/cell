import {
  openVideoFile,
  openSubtitleFile,
  verifyPermission,
} from './useFileSystemAccess';

// ── Helpers ──────────────────────────────────────────────────────────
/** Creates a mock FileSystemFileHandle whose getFile() resolves to `file`. */
function createMockFileHandle(name: string, file: File): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: jest.fn().mockResolvedValue(file),
    createWritable: jest.fn(),
    isSameEntry: jest.fn(),
    queryPermission: jest.fn(),
    requestPermission: jest.fn(),
    remove: jest.fn(),
    move: jest.fn(),
  } as unknown as FileSystemFileHandle;
}

/** Installs a mock showOpenFilePicker on window and returns a spy. */
function mockShowOpenFilePicker(
  handles: FileSystemFileHandle[] | Error,
): jest.SpyInstance {
  // jsdom doesn't define showOpenFilePicker — install a stub first so
  // jest.spyOn can find the property.
  if (!(window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker) {
    (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker =
      jest.fn();
  }
  const spy = jest.spyOn(window, 'showOpenFilePicker');
  if (handles instanceof Error) {
    spy.mockRejectedValue(handles);
  } else {
    spy.mockResolvedValue(handles);
  }
  return spy;
}

beforeEach(() => {
  jest.restoreAllMocks();
});

// ── openVideoFile ────────────────────────────────────────────────────
describe('openVideoFile', () => {
  it('calls showOpenFilePicker with id "local-player-video" and video types', async () => {
    const file = new File([], 'movie.mp4', { type: 'video/mp4' });
    const handle = createMockFileHandle('movie.mp4', file);
    const spy = mockShowOpenFilePicker([handle]);

    await openVideoFile();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'local-player-video',
        multiple: false,
        types: expect.arrayContaining([
          expect.objectContaining({
            accept: expect.objectContaining({
              'video/*': expect.arrayContaining([
                '.mp4',
                '.webm',
                '.ogg',
                '.ogv',
                '.mov',
              ]),
            }),
          }),
        ]),
      }),
    );
  });

  it('returns { file, handle } on success', async () => {
    const file = new File([], 'movie.mp4', { type: 'video/mp4' });
    const handle = createMockFileHandle('movie.mp4', file);
    mockShowOpenFilePicker([handle]);

    const result = await openVideoFile();

    expect(result).not.toBeNull();
    expect(result?.handle).toBe(handle);
    expect(result?.file).toBe(file);
  });

  it('returns null on AbortError (user cancelled)', async () => {
    const abortError = new DOMException(
      'User dismissed the prompt',
      'AbortError',
    );
    mockShowOpenFilePicker(abortError);

    const result = await openVideoFile();

    expect(result).toBeNull();
  });

  it('throws on SecurityError (unsupported / no user gesture)', async () => {
    const securityError = new DOMException(
      'Blocked by same-origin policy',
      'SecurityError',
    );
    mockShowOpenFilePicker(securityError);

    await expect(openVideoFile()).rejects.toThrow(securityError);
  });
});

// ── openSubtitleFile ─────────────────────────────────────────────────
describe('openSubtitleFile', () => {
  it('calls showOpenFilePicker with id "local-player-subtitle" and subtitle extensions', async () => {
    const file = new File([], 'movie.srt', { type: 'text/plain' });
    const handle = createMockFileHandle('movie.srt', file);
    const spy = mockShowOpenFilePicker([handle]);

    await openSubtitleFile();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'local-player-subtitle',
        multiple: false,
        types: expect.arrayContaining([
          expect.objectContaining({
            accept: expect.objectContaining({
              'text/*': expect.arrayContaining([
                '.srt',
                '.vtt',
                '.ass',
                '.ssa',
                '.ttml',
                '.dfxp',
                '.sbv',
                '.smi',
              ]),
            }),
          }),
        ]),
      }),
    );
  });

  it('returns { file, handle } on success', async () => {
    const file = new File([], 'movie.vtt', { type: 'text/vtt' });
    const handle = createMockFileHandle('movie.vtt', file);
    mockShowOpenFilePicker([handle]);

    const result = await openSubtitleFile();

    expect(result).not.toBeNull();
    expect(result?.handle).toBe(handle);
    expect(result?.file).toBe(file);
  });

  it('returns null on AbortError (user cancelled)', async () => {
    const abortError = new DOMException('Cancelled', 'AbortError');
    mockShowOpenFilePicker(abortError);

    const result = await openSubtitleFile();

    expect(result).toBeNull();
  });
});

// ── verifyPermission ─────────────────────────────────────────────────
describe('verifyPermission', () => {
  it('returns true when queryPermission already grants read', async () => {
    const handle = createMockFileHandle('f.mp4', new File([], 'f.mp4'));
    (handle.queryPermission as jest.Mock).mockResolvedValue('granted');

    const result = await verifyPermission(handle, false);

    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('returns true when queryPermission already grants readwrite', async () => {
    const handle = createMockFileHandle('f.mp4', new File([], 'f.mp4'));
    (handle.queryPermission as jest.Mock).mockResolvedValue('granted');

    const result = await verifyPermission(handle, true);

    expect(handle.queryPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    });
    expect(result).toBe(true);
  });

  it('calls requestPermission when queryPermission returns "prompt"', async () => {
    const handle = createMockFileHandle('f.mp4', new File([], 'f.mp4'));
    (handle.queryPermission as jest.Mock).mockResolvedValue('prompt');
    (handle.requestPermission as jest.Mock).mockResolvedValue('granted');

    const result = await verifyPermission(handle, false);

    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(result).toBe(true);
  });

  it('returns false when requestPermission also denies', async () => {
    const handle = createMockFileHandle('f.mp4', new File([], 'f.mp4'));
    (handle.queryPermission as jest.Mock).mockResolvedValue('prompt');
    (handle.requestPermission as jest.Mock).mockResolvedValue('denied');

    const result = await verifyPermission(handle, true);

    expect(handle.requestPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    });
    expect(result).toBe(false);
  });

  it('returns false when queryPermission returns "denied"', async () => {
    const handle = createMockFileHandle('f.mp4', new File([], 'f.mp4'));
    (handle.queryPermission as jest.Mock).mockResolvedValue('denied');

    const result = await verifyPermission(handle, false);

    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
