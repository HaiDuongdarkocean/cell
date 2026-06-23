import { MessageBus } from '@/background/messageBus';
import type {
  MessageRequest,
  MessageResponse,
  MessageHandler,
} from '@/types/message';

// --- Mock chrome.runtime ---
type Listener = (
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
) => boolean | void;

interface MockChromeRuntime {
  sendMessage: jest.Mock;
  onMessage: {
    addListener: jest.Mock;
    removeListener: jest.Mock;
    hasListener: jest.Mock;
  };
}

function createMockChrome(): MockChromeRuntime {
  const listeners: Listener[] = [];
  return {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn((listener: Listener) => {
        listeners.push(listener);
      }),
      removeListener: jest.fn((listener: Listener) => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      }),
      hasListener: jest.fn((listener: Listener) =>
        listeners.includes(listener),
      ),
    },
  };
}

let mockChrome: MockChromeRuntime;

beforeEach(() => {
  mockChrome = createMockChrome();
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: mockChrome,
  };
});

afterEach(() => {
  jest.useRealTimers();
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
});

describe('MessageBus', () => {
  describe('on()', () => {
    it('registers a handler and returns an unsubscribe function', () => {
      const bus = new MessageBus();
      const handler: MessageHandler = jest.fn();

      const off = bus.on('DETECT_MEDIA', handler);

      expect(typeof off).toBe('function');

      // Handler should be invoked via handleMessage
      const request: MessageRequest = { type: 'DETECT_MEDIA', payload: 1 };
      void bus.handleMessage(request, { id: 1 });
      expect(handler).toHaveBeenCalledWith(request);
    });

    it('unsubscribe removes the handler', () => {
      const bus = new MessageBus();
      const handler: MessageHandler = jest.fn();

      const off = bus.on('DETECT_MEDIA', handler);
      off();

      const request: MessageRequest = { type: 'DETECT_MEDIA', payload: 1 };
      return bus.handleMessage(request, { id: 1 }).then((response) => {
        expect(handler).not.toHaveBeenCalled();
        expect(response.success).toBe(false);
        expect(response.error).toContain('No handler');
      });
    });
  });

  describe('send()', () => {
    it('calls chrome.runtime.sendMessage with the request', () => {
      const bus = new MessageBus();
      const request: MessageRequest = { type: 'GET_SETTINGS' };

      mockChrome.sendMessage.mockResolvedValue({ success: true });

      return bus.send(request).then(() => {
        expect(mockChrome.sendMessage).toHaveBeenCalledWith(request);
      });
    });

    it('resolves with the response on success', () => {
      const bus = new MessageBus();
      const request: MessageRequest = { type: 'GET_SETTINGS' };
      const response: MessageResponse<{ theme: string }> = {
        success: true,
        data: { theme: 'dark' },
      };
      mockChrome.sendMessage.mockResolvedValue(response);

      return bus.send<{ theme: string }>(request).then((res) => {
        expect(res).toEqual(response);
        expect(res.success).toBe(true);
        expect(res.data).toEqual({ theme: 'dark' });
      });
    });

    it('rejects on timeout', () => {
      const bus = new MessageBus();
      const request: MessageRequest = { type: 'GET_SETTINGS' };

      // Never resolves
      mockChrome.sendMessage.mockReturnValue(new Promise(() => {}));

      const promise = bus.send(request, 50);
      return expect(promise).rejects.toThrow(/timeout/i);
    });
  });

  describe('sendNoWait()', () => {
    it('calls chrome.runtime.sendMessage without awaiting', () => {
      const bus = new MessageBus();
      const request: MessageRequest = { type: 'GET_SETTINGS' };

      bus.sendNoWait(request);

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(request);
    });
  });

  describe('broadcast()', () => {
    it('calls chrome.runtime.sendMessage with the payload', () => {
      const bus = new MessageBus();
      const payload: MessageRequest = {
        type: 'DETECTED_MEDIA_UPDATE',
        payload: { videos: [], subtitles: [] },
      };

      bus.broadcast(payload);

      expect(mockChrome.sendMessage).toHaveBeenCalledWith(payload);
    });
  });

  describe('handleMessage()', () => {
    it('calls the registered handler and returns its response', () => {
      const bus = new MessageBus();
      const handler: MessageHandler = jest
        .fn()
        .mockResolvedValue({ success: true, data: 'ok' });

      bus.on('DETECT_MEDIA', handler);

      const request: MessageRequest = { type: 'DETECT_MEDIA', payload: 42 };
      return bus.handleMessage(request, { id: 1 }).then((response) => {
        expect(handler).toHaveBeenCalledWith(request);
        expect(response).toEqual({ success: true, data: 'ok' });
      });
    });

    it('returns an error response for an unregistered type', () => {
      const bus = new MessageBus();
      const request: MessageRequest = { type: 'GET_SETTINGS' };

      return bus.handleMessage(request, { id: 1 }).then((response) => {
        expect(response.success).toBe(false);
        expect(response.error).toBe('No handler for type: GET_SETTINGS');
      });
    });

    it('returns an error response when handler throws', () => {
      const bus = new MessageBus();
      const handler: MessageHandler = jest
        .fn<Promise<MessageResponse>, [MessageRequest]>()
        .mockRejectedValue(new Error('boom'));

      bus.on('DOWNLOAD_VIDEO', handler);

      const request: MessageRequest = { type: 'DOWNLOAD_VIDEO' };
      return bus.handleMessage(request, { id: 1 }).then((response) => {
        expect(response.success).toBe(false);
        expect(response.error).toBe('boom');
      });
    });
  });

  describe('start() / stop()', () => {
    it('start() adds a listener to chrome.runtime.onMessage', () => {
      const bus = new MessageBus();
      bus.start();

      expect(mockChrome.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(typeof mockChrome.onMessage.addListener.mock.calls[0][0]).toBe(
        'function',
      );
    });

    it('stop() removes the listener from chrome.runtime.onMessage', () => {
      const bus = new MessageBus();
      bus.start();
      bus.stop();

      expect(mockChrome.onMessage.removeListener).toHaveBeenCalledTimes(1);
      const added = mockChrome.onMessage.addListener.mock.calls[0][0];
      const removed = mockChrome.onMessage.removeListener.mock.calls[0][0];
      expect(removed).toBe(added);
    });

    it('listener routes messages to handleMessage and sends response back', () => {
      const bus = new MessageBus();
      const handler: MessageHandler = jest
        .fn()
        .mockResolvedValue({ success: true, data: 'routed' });
      bus.on('DETECT_MEDIA', handler);
      bus.start();

      const listener = mockChrome.onMessage.addListener.mock
        .calls[0][0] as Listener;
      const sendResponse = jest.fn();
      const request: MessageRequest = { type: 'DETECT_MEDIA', payload: 7 };

      // Returning true means sendResponse will be called asynchronously
      const result = listener(request, { id: 1 }, sendResponse);

      expect(result).toBe(true);
      // Flush the async handler chain (mockResolvedValue + handleMessage await).
      return new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          data: 'routed',
        });
      });
    });
  });
});
