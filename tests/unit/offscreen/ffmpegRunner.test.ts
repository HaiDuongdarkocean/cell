/**
 * Unit tests for the offscreen transmuxer runner (V2: OPFS-based).
 *
 * The runner reads `input.ts` from OPFS, transmuxes it to `output.mp4` using
 * mux.js, and writes the result back to OPFS. Both OPFS and mux.js are mocked.
 */

// ---- OPFS mock ----

class MockFileHandle {
  constructor(public name: string, public file: { data: Uint8Array; lastModified: number }) {}

  async getFile(): Promise<File> {
    return new File([this.file.data.slice().buffer as ArrayBuffer], this.name, {
      type: 'application/octet-stream',
      lastModified: this.file.lastModified,
    });
  }
}

class MockDirHandle {
  files = new Map<string, MockFileHandle>();

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (opts?.create) {
      const h = new MockFileHandle(name, { data: new Uint8Array(), lastModified: Date.now() });
      this.files.set(name, h);
      return h;
    }
    throw new DOMException(`File not found: ${name}`, 'NotFoundError');
  }

  async createWritable(_opts?: { keepExistingData?: boolean }): Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }> {
    // Not used directly by the runner, but needed by tsTransmuxer.
    let closed = false;
    return {
      async write(_data: Blob): Promise<void> {
        if (closed) throw new DOMException('closed', 'InvalidStateError');
      },
      async close(): Promise<void> {
        closed = true;
      },
    };
  }
}

const downloadDirs = new Map<string, MockDirHandle>();

jest.mock('@/lib/storage/opfsStorage', () => ({
  ensureDownloadSubdir: jest.fn(async (downloadId: string) => {
    let dir = downloadDirs.get(downloadId);
    if (!dir) {
      dir = new MockDirHandle();
      downloadDirs.set(downloadId, dir);
    }
    return dir;
  }),
  readFile: jest.fn(async (dirHandle: MockDirHandle, filename: string) => {
    const fh = dirHandle.files.get(filename);
    if (!fh) throw new DOMException(`File not found: ${filename}`, 'NotFoundError');
    return fh.getFile();
  }),
  deleteFile: jest.fn(),
  deleteDownloadSubdir: jest.fn(),
  isOpfsAvailable: jest.fn().mockReturnValue(true),
}));

// ---- mux.js mock ----

jest.mock('@/lib/converters/tsTransmuxer', () => ({
  transmuxTsToFmp4: jest.fn(),
}));

// ---- chrome mock ----

const onMessageListeners: Array<
  (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | undefined
> = [];

const chromeMock = {
  runtime: {
    onMessage: {
      addListener: jest.fn((listener: typeof onMessageListeners[0]) => {
        onMessageListeners.push(listener);
      }),
      removeListener: jest.fn((listener: typeof onMessageListeners[0]) => {
        const idx = onMessageListeners.indexOf(listener);
        if (idx >= 0) onMessageListeners.splice(idx, 1);
      }),
    },
  },
};

beforeAll(() => {
  globalThis.chrome = chromeMock as unknown as typeof chrome;

  // Polyfill Blob.arrayBuffer for jsdom
  if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
  if (typeof File !== 'undefined' && typeof File.prototype.arrayBuffer !== 'function') {
    File.prototype.arrayBuffer = Blob.prototype.arrayBuffer as never;
  }

  // Polyfill URL.createObjectURL / revokeObjectURL for jsdom (offscreen
  // document context has these natively; jsdom does not).
  if (typeof URL.createObjectURL !== 'function') {
    let counter = 0;
    URL.createObjectURL = function (obj: Blob | MediaSource): string {
      const id = ++counter;
      const size = obj instanceof Blob ? obj.size : 0;
      return `blob:fake-${id}-${size}`;
    };
    URL.revokeObjectURL = function () {
      // no-op
    };
  }
});

import {
  convertTsToMp4V2,
  createOpfsBlobUrl,
  revokeOpfsBlobUrl,
  activeBlobUrlCount,
  startMessageListener,
  stopMessageListener,
  resetFFmpeg,
} from '@/offscreen/ffmpegRunner';
import { transmuxTsToFmp4 } from '@/lib/converters/tsTransmuxer';
import { ensureDownloadSubdir, readFile as opfsReadFile } from '@/lib/storage/opfsStorage';
import { MESSAGE_TYPES } from '@/constants/messages';

describe('offscreen ffmpegRunner (V2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onMessageListeners.length = 0;
    downloadDirs.clear();
    (transmuxTsToFmp4 as jest.Mock).mockResolvedValue({
      success: true,
      outputName: 'output.mp4',
    });
  });

  afterEach(() => {
    resetFFmpeg();
  });

  describe('convertTsToMp4V2', () => {
    it('reads input.ts from OPFS, transmuxes, and returns success result', async () => {
      // Pre-populate OPFS with an input.ts file.
      const dir = new MockDirHandle();
      dir.files.set(
        'input.ts',
        new MockFileHandle('input.ts', {
          data: new Uint8Array([1, 2, 3, 4]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-123', dir);

      const result = await convertTsToMp4V2('dl-123');

      expect(ensureDownloadSubdir).toHaveBeenCalledWith('dl-123');
      expect(opfsReadFile).toHaveBeenCalledWith(dir, 'input.ts');
      expect(transmuxTsToFmp4).toHaveBeenCalledTimes(1);
      // The transmuxer receives (inputFile, dirHandle, outputName)
      const [inputFile, dirArg, outputName] = (transmuxTsToFmp4 as jest.Mock).mock.calls[0];
      expect(inputFile).toBeInstanceOf(File);
      expect((inputFile as File).size).toBe(4);
      expect(dirArg).toBe(dir);
      expect(outputName).toBe('output.mp4');

      expect(result.success).toBe(true);
      expect(result.downloadId).toBe('dl-123');
      expect(result.outputName).toBe('output.mp4');
      expect(result.mimeType).toBe('video/mp4');
    });

    it('returns failure when transmuxer fails', async () => {
      const dir = new MockDirHandle();
      dir.files.set(
        'input.ts',
        new MockFileHandle('input.ts', {
          data: new Uint8Array([1]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-err', dir);

      (transmuxTsToFmp4 as jest.Mock).mockResolvedValue({
        success: false,
        outputName: 'output.mp4',
        error: 'Unsupported codec: HEVC',
      });

      const result = await convertTsToMp4V2('dl-err');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported codec: HEVC');
    });

    it('throws when input.ts does not exist in OPFS', async () => {
      const dir = new MockDirHandle();
      downloadDirs.set('dl-missing', dir);

      await expect(convertTsToMp4V2('dl-missing')).rejects.toThrow();
    });
  });

  describe('startMessageListener', () => {
    it('adds a listener to chrome.runtime.onMessage', async () => {
      await startMessageListener();

      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(onMessageListeners).toHaveLength(1);
    });

    it('does not add a second listener on repeated calls', async () => {
      await startMessageListener();
      await startMessageListener();

      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopMessageListener', () => {
    it('removes the listener from chrome.runtime.onMessage', async () => {
      await startMessageListener();
      stopMessageListener();

      expect(chromeMock.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
      expect(onMessageListeners).toHaveLength(0);
    });
  });

  describe('message listener', () => {
    it('calls convertTsToMp4V2 on CONVERT_TS_TO_MP4_V2 message and sends success response', async () => {
      // Pre-populate OPFS
      const dir = new MockDirHandle();
      dir.files.set(
        'input.ts',
        new MockFileHandle('input.ts', {
          data: new Uint8Array([1, 2]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-xyz', dir);

      await startMessageListener();
      const listener = onMessageListeners[0];

      const message = {
        type: MESSAGE_TYPES.CONVERT_TS_TO_MP4_V2,
        payload: { downloadId: 'dl-xyz' },
      };
      const sendResponse = jest.fn();

      const returnValue = listener(message, {} as chrome.runtime.MessageSender, sendResponse);

      // Async handler returns true to keep the message channel open
      expect(returnValue).toBe(true);

      // Wait for the async handler to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as {
        success: boolean;
        data?: { downloadId: string; outputName: string; mimeType: string; success: boolean };
      };
      expect(response.success).toBe(true);
      expect(response.data?.downloadId).toBe('dl-xyz');
      expect(response.data?.outputName).toBe('output.mp4');
      expect(response.data?.mimeType).toBe('video/mp4');
    });

    it('returns false for non-CONVERT_TS_TO_MP4_V2 messages', async () => {
      await startMessageListener();
      const listener = onMessageListeners[0];

      const returnValue = listener(
        { type: 'SOME_OTHER_MESSAGE' },
        {} as chrome.runtime.MessageSender,
        jest.fn(),
      );

      expect(returnValue).toBe(false);
    });

    it('sends error response when conversion fails', async () => {
      // Pre-populate OPFS so readFile succeeds, then transmuxer throws.
      const dir = new MockDirHandle();
      dir.files.set(
        'input.ts',
        new MockFileHandle('input.ts', {
          data: new Uint8Array([1, 2]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-crash', dir);

      (transmuxTsToFmp4 as jest.Mock).mockRejectedValue(new Error('Transmux crashed'));

      await startMessageListener();
      const listener = onMessageListeners[0];

      const message = {
        type: MESSAGE_TYPES.CONVERT_TS_TO_MP4_V2,
        payload: { downloadId: 'dl-crash' },
      };
      const sendResponse = jest.fn();

      listener(message, {} as chrome.runtime.MessageSender, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const response = sendResponse.mock.calls[0][0] as {
        success: boolean;
        error?: string;
      };
      expect(response.success).toBe(false);
      expect(response.error).toContain('Transmux crashed');
    });
  });

  describe('runtime bootstrap', () => {
    it('auto-registers listener when imported in extension context (no JEST_WORKER_ID)', async () => {
      // Temporarily clear JEST_WORKER_ID to simulate non-test environment,
      // then dynamically re-import the module to trigger bootstrap.
      const originalWorkerId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;

      // Clear the module cache so bootstrap runs again on re-import.
      jest.resetModules();
      // Re-mock dependencies after resetModules.
      jest.doMock('@/lib/storage/opfsStorage', () => ({
        ensureDownloadSubdir: jest.fn(),
        readFile: jest.fn(),
        deleteFile: jest.fn(),
        deleteDownloadSubdir: jest.fn(),
        isOpfsAvailable: jest.fn().mockReturnValue(true),
        createOpfsWriter: jest.fn(),
      }));
      jest.doMock('@/lib/converters/tsTransmuxer', () => ({
        transmuxTsToFmp4: jest.fn(),
      }));

      // chrome mock is on globalThis; resetModules doesn't clear globals.
      // The addListener mock should capture the bootstrap registration.
      const addListenerSpy = chromeMock.runtime.onMessage.addListener;
      addListenerSpy.mockClear();

      await import('@/offscreen/ffmpegRunner');

      // Bootstrap calls startMessageListener() which calls addListener.
      // Wait a microtask for the async startMessageListener to resolve.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(addListenerSpy).toHaveBeenCalled();

      // Restore test environment.
      process.env.JEST_WORKER_ID = originalWorkerId;
    });

    it('does NOT auto-register in test environment (JEST_WORKER_ID set)', async () => {
      // JEST_WORKER_ID is set by Jest, so bootstrap should skip.
      jest.resetModules();
      jest.doMock('@/lib/storage/opfsStorage', () => ({
        ensureDownloadSubdir: jest.fn(),
        readFile: jest.fn(),
        deleteFile: jest.fn(),
        deleteDownloadSubdir: jest.fn(),
        isOpfsAvailable: jest.fn().mockReturnValue(true),
        createOpfsWriter: jest.fn(),
      }));
      jest.doMock('@/lib/converters/tsTransmuxer', () => ({
        transmuxTsToFmp4: jest.fn(),
      }));

      const addListenerSpy = chromeMock.runtime.onMessage.addListener;
      const callCountBefore = addListenerSpy.mock.calls.length;

      await import('@/offscreen/ffmpegRunner');
      await new Promise((resolve) => setTimeout(resolve, 0));

      // No new addListener calls from bootstrap (JEST_WORKER_ID is set).
      expect(addListenerSpy.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('createOpfsBlobUrl', () => {
    it('reads an OPFS file and returns a Blob URL', async () => {
      const dir = new MockDirHandle();
      dir.files.set(
        'output.mp4',
        new MockFileHandle('output.mp4', {
          data: new Uint8Array([0, 1, 2, 3, 4]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-blob', dir);

      const result = await createOpfsBlobUrl('dl-blob', 'output.mp4', 'video/mp4');

      expect(result.url).toMatch(/^blob:/);
      expect(activeBlobUrlCount()).toBe(1);
    });

    it('throws when the OPFS file does not exist', async () => {
      downloadDirs.set('dl-missing-blob', new MockDirHandle());

      await expect(
        createOpfsBlobUrl('dl-missing-blob', 'nope.mp4', 'video/mp4'),
      ).rejects.toThrow();
    });
  });

  describe('revokeOpfsBlobUrl', () => {
    it('revokes a previously-created Blob URL', async () => {
      const dir = new MockDirHandle();
      dir.files.set(
        'input.ts',
        new MockFileHandle('input.ts', {
          data: new Uint8Array([1]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-revoke', dir);

      const { url } = await createOpfsBlobUrl('dl-revoke', 'input.ts', 'video/mp2t');
      expect(activeBlobUrlCount()).toBe(1);

      revokeOpfsBlobUrl(url);
      expect(activeBlobUrlCount()).toBe(0);
    });

    it('is a no-op for an unknown URL', () => {
      expect(() => revokeOpfsBlobUrl('blob:unknown')).not.toThrow();
      expect(activeBlobUrlCount()).toBe(0);
    });
  });

  describe('stopMessageListener cleanup', () => {
    it('revokes all active Blob URLs on stop', async () => {
      const dir = new MockDirHandle();
      dir.files.set(
        'input.ts',
        new MockFileHandle('input.ts', {
          data: new Uint8Array([1]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-cleanup', dir);

      await createOpfsBlobUrl('dl-cleanup', 'input.ts', 'video/mp2t');
      expect(activeBlobUrlCount()).toBe(1);

      stopMessageListener();
      expect(activeBlobUrlCount()).toBe(0);
    });
  });

  describe('message listener: CREATE_OPFS_BLOB_URL', () => {
    it('creates a Blob URL and sends it back in the response', async () => {
      const dir = new MockDirHandle();
      dir.files.set(
        'output.mp4',
        new MockFileHandle('output.mp4', {
          data: new Uint8Array([1, 2, 3]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-msg-blob', dir);

      await startMessageListener();
      const listener = onMessageListeners[0];

      const message = {
        type: MESSAGE_TYPES.CREATE_OPFS_BLOB_URL,
        payload: { downloadId: 'dl-msg-blob', opfsFilename: 'output.mp4', mimeType: 'video/mp4' },
      };
      const sendResponse = jest.fn();

      listener(message, {} as chrome.runtime.MessageSender, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as {
        success: boolean;
        data?: { url: string };
      };
      expect(response.success).toBe(true);
      expect(response.data?.url).toMatch(/^blob:/);
    });
  });

  describe('message listener: REVOKE_OPFS_BLOB_URL', () => {
    it('revokes the Blob URL and sends success response', async () => {
      const dir = new MockDirHandle();
      dir.files.set(
        'input.ts',
        new MockFileHandle('input.ts', {
          data: new Uint8Array([1]),
          lastModified: Date.now(),
        }),
      );
      downloadDirs.set('dl-msg-revoke', dir);

      const { url } = await createOpfsBlobUrl('dl-msg-revoke', 'input.ts', 'video/mp2t');

      await startMessageListener();
      const listener = onMessageListeners[0];

      const message = {
        type: MESSAGE_TYPES.REVOKE_OPFS_BLOB_URL,
        payload: { url },
      };
      const sendResponse = jest.fn();

      listener(message, {} as chrome.runtime.MessageSender, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as { success: boolean };
      expect(response.success).toBe(true);
      expect(activeBlobUrlCount()).toBe(0);
    });
  });
});
