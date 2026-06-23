import type { FFmpeg, FileData, OK, IsFirst } from '@ffmpeg/ffmpeg';

// === Mocks ===

const mockFFmpegInstance: {
  load: jest.Mock;
  writeFile: jest.Mock;
  exec: jest.Mock;
  readFile: jest.Mock;
  deleteFile: jest.Mock;
  loaded: boolean;
} = {
  load: jest.fn(),
  writeFile: jest.fn(),
  exec: jest.fn(),
  readFile: jest.fn(),
  deleteFile: jest.fn(),
  loaded: false,
};

const MockFFmpeg = jest.fn(() => mockFFmpegInstance) as unknown as jest.MockedClass<
  typeof FFmpeg
>;

jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: MockFFmpeg,
}));

jest.mock('@ffmpeg/util', () => ({
  fetchFile: jest.fn(),
}));

import { fetchFile } from '@ffmpeg/util';
import {
  initFFmpeg,
  convertTsToMp4,
  startMessageListener,
  stopMessageListener,
  resetFFmpeg,
} from '@/offscreen/ffmpegRunner';

// === Chrome mock ===

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

const onMessageListeners: MessageListener[] = [];

const chromeMock = {
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://fake-id/${path}`),
    onMessage: {
      addListener: jest.fn((listener: MessageListener) => {
        onMessageListeners.push(listener);
      }),
      removeListener: jest.fn((listener: MessageListener) => {
        const index = onMessageListeners.indexOf(listener);
        if (index !== -1) {
          onMessageListeners.splice(index, 1);
        }
      }),
      hasListener: jest.fn(),
    },
  },
};

global.chrome = chromeMock as unknown as typeof chrome;

// === Helpers ===

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

describe('ffmpegRunner', () => {
  beforeEach(() => {
    // Reset module state first (may call removeListener), then clear counts.
    resetFFmpeg();
    jest.clearAllMocks();
    onMessageListeners.length = 0;
    mockFFmpegInstance.loaded = false;
    mockFFmpegInstance.load.mockResolvedValue(true as IsFirst);
    mockFFmpegInstance.writeFile.mockResolvedValue(true as OK);
    mockFFmpegInstance.exec.mockResolvedValue(0);
    mockFFmpegInstance.readFile.mockResolvedValue(
      toUint8Array(new ArrayBuffer(0)) as FileData,
    );
    mockFFmpegInstance.deleteFile.mockResolvedValue(true as OK);
    (fetchFile as jest.Mock).mockResolvedValue(new Uint8Array(0));
  });

  describe('initFFmpeg', () => {
    it('creates an FFmpeg instance and calls load()', async () => {
      const ffmpeg = await initFFmpeg();

      expect(MockFFmpeg).toHaveBeenCalledTimes(1);
      expect(ffmpeg).toBe(mockFFmpegInstance);
      expect(mockFFmpegInstance.load).toHaveBeenCalledTimes(1);
      expect(mockFFmpegInstance.load).toHaveBeenCalledWith(
        expect.objectContaining({
          coreURL: expect.stringContaining('ffmpeg-core.js'),
        }),
      );
    });

    it('returns the same instance on a second call (singleton)', async () => {
      const first = await initFFmpeg();
      const second = await initFFmpeg();

      expect(first).toBe(second);
      expect(MockFFmpeg).toHaveBeenCalledTimes(1);
      expect(mockFFmpegInstance.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('convertTsToMp4', () => {
    it('writes segments, runs ffmpeg, reads output, and returns an ArrayBuffer', async () => {
      const segments = [
        new ArrayBuffer(4),
        new ArrayBuffer(6),
      ];
      const downloadId = 'dl-123';

      const mp4Bytes = new Uint8Array([1, 2, 3, 4, 5]);
      mockFFmpegInstance.readFile.mockResolvedValue(mp4Bytes as FileData);

      const result = await convertTsToMp4(segments, downloadId);

      // Each segment written to FS as segment_N.ts
      expect(mockFFmpegInstance.writeFile).toHaveBeenCalledTimes(2);
      expect(mockFFmpegInstance.writeFile).toHaveBeenNthCalledWith(
        1,
        'segment_0.ts',
        expect.any(Uint8Array),
      );
      expect(mockFFmpegInstance.writeFile).toHaveBeenNthCalledWith(
        2,
        'segment_1.ts',
        expect.any(Uint8Array),
      );

      // ffmpeg exec called with concat input and copy codec
      expect(mockFFmpegInstance.exec).toHaveBeenCalledTimes(1);
      const execArgs = mockFFmpegInstance.exec.mock.calls[0][0] as string[];
      expect(execArgs).toContain('-c');
      expect(execArgs).toContain('copy');
      expect(execArgs.some((a) => a.startsWith('concat:'))).toBe(true);
      expect(execArgs[execArgs.length - 1]).toBe('output.mp4');

      // Read output
      expect(mockFFmpegInstance.readFile).toHaveBeenCalledWith('output.mp4');

      // Temp files deleted (segments + output)
      expect(mockFFmpegInstance.deleteFile).toHaveBeenCalledWith('segment_0.ts');
      expect(mockFFmpegInstance.deleteFile).toHaveBeenCalledWith('segment_1.ts');
      expect(mockFFmpegInstance.deleteFile).toHaveBeenCalledWith('output.mp4');

      // Returns ArrayBuffer with the same bytes
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(result)).toEqual(mp4Bytes);
    });
  });

  describe('startMessageListener', () => {
    it('adds a listener to chrome.runtime.onMessage', () => {
      startMessageListener();

      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(onMessageListeners).toHaveLength(1);
    });
  });

  describe('stopMessageListener', () => {
    it('removes the listener from chrome.runtime.onMessage', () => {
      startMessageListener();
      stopMessageListener();

      expect(chromeMock.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
      expect(onMessageListeners).toHaveLength(0);
    });
  });

  describe('message listener', () => {
    it('calls convertTsToMp4 on CONVERT_TS_TO_MP4 message and sends response', async () => {
      const mp4Bytes = new Uint8Array([9, 9, 9]);
      mockFFmpegInstance.readFile.mockResolvedValue(mp4Bytes as FileData);

      startMessageListener();
      expect(onMessageListeners).toHaveLength(1);
      const listener = onMessageListeners[0];

      const segments = [new ArrayBuffer(2)];
      const message = {
        type: 'CONVERT_TS_TO_MP4',
        payload: { segments, downloadId: 'dl-xyz' },
      };
      const sendResponse = jest.fn();

      const returnValue = listener(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      // Async handler returns true to keep the message channel open
      expect(returnValue).toBe(true);

      // Wait for the async handler to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockFFmpegInstance.writeFile).toHaveBeenCalledTimes(1);
      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as {
        success: boolean;
        data?: { downloadId: string; mp4Data: ArrayBuffer };
      };
      expect(response.success).toBe(true);
      expect(response.data?.downloadId).toBe('dl-xyz');
      expect(response.data?.mp4Data).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(response.data!.mp4Data)).toEqual(mp4Bytes);
    });
  });
});
