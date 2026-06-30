import type {
  MessageRequest,
  MessageResponse,
  MessageHandler,
  MessageType,
} from '@/types/message';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Wraps `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` for typed
 * message passing between popup, background, and content script.
 */
export class MessageBus {
  private handlers: Map<MessageType, MessageHandler> = new Map();
  private boundListener: ((
    request: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => boolean) | null = null;

  /**
   * Register a handler for a message type.
   * @returns an unsubscribe function.
   */
  on<T extends MessageType>(type: T, handler: MessageHandler): () => void {
    this.handlers.set(type, handler);
    return () => {
      if (this.handlers.get(type) === handler) {
        this.handlers.delete(type);
      }
    };
  }

  /**
   * Send a message and wait for the response (request-response pattern).
   * Rejects if no response arrives within `timeoutMs` (default 30s).
   */
  send<T = unknown>(
    request: MessageRequest,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<MessageResponse<T>> {
    return new Promise<MessageResponse<T>>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Message send timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      chrome.runtime
        .sendMessage(request)
        .then((response: MessageResponse<T>) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(response);
          }
        })
        .catch((error: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        });
    });
  }

  /**
   * Send a message without waiting for a response (fire-and-forget).
   */
  sendNoWait(request: MessageRequest): void {
    void chrome.runtime.sendMessage(request);
  }

  /**
   * Broadcast a message to all listeners (background -> popup).
   */
  broadcast(payload: MessageRequest): void {
    void chrome.runtime.sendMessage(payload);
  }

  /**
   * Handle an incoming message. Extracted for testability.
   * Injects sender.tab.id into payload when tabId is missing (content scripts
   * don't have chrome.tabs API — they send without tabId, background resolves it).
   */
  async handleMessage(
    request: MessageRequest,
    sender: chrome.runtime.MessageSender,
  ): Promise<MessageResponse> {
    const handler = this.handlers.get(request.type);
    if (!handler) {
      return {
        success: false,
        error: `No handler for type: ${request.type}`,
      };
    }

    // Inject tabId from sender when missing (content script → background)
    if (sender.tab?.id !== undefined) {
      const payload = request.payload as Record<string, unknown> | undefined;
      if (payload && payload.tabId === undefined) {
        payload.tabId = sender.tab.id;
      }
    }

    try {
      return await handler(request);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Start listening to chrome.runtime.onMessage.
   */
  start(): void {
    if (this.boundListener) {
      return;
    }

    const listener = (
      request: MessageRequest,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: MessageResponse) => void,
    ): boolean => {
      // Respond asynchronously.
      void this.handleMessage(request, sender).then(sendResponse);
      return true;
    };

    this.boundListener = listener;
    chrome.runtime.onMessage.addListener(listener);
  }

  /**
   * Stop listening.
   */
  stop(): void {
    if (!this.boundListener) {
      return;
    }
    chrome.runtime.onMessage.removeListener(this.boundListener);
    this.boundListener = null;
  }
}
