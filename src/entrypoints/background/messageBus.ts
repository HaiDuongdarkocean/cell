import {
  sendMessage,
  onMessage,
  removeOnMessageListener,
} from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type {
  MessageRequest,
  MessageResponse,
  MessageHandler,
  MessageType,
} from '@/entities/message';

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

      sendMessage<MessageResponse<T>>(request)
        .then((response) => {
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
    void sendMessage(request);
  }

  /**
   * Broadcast a message to all listeners (background -> popup).
   */
  broadcast(payload: MessageRequest): void {
    void sendMessage(payload);
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
    // Skip _OFFSCREEN_ prefixed messages — these are forwarded by background
    // to the offscreen document. The start() listener already returns false for
    // these, so handleMessage is never called with them. This is a safety net.
    if (request.type.startsWith('_OFFSCREEN_')) {
      return new Promise<MessageResponse>(() => {});
    }
    const handler = this.handlers.get(request.type);
    if (!handler) {
      return {
        success: false,
        error: `No handler for type: ${request.type}`,
      };
    }

    // Inject tabId/frameId from sender when missing (content script → background).
    // Create a shallow copy to avoid mutating the original request payload
    // (callers may retain references for retry/logging).
    if (sender.tab?.id !== undefined) {
      const payload = request.payload as Record<string, unknown> | undefined;
      if (payload) {
        const next: Record<string, unknown> = { ...payload };
        if (next.tabId === undefined) {
          next.tabId = sender.tab.id;
        }
        if (next.frameId === undefined && sender.frameId !== undefined) {
          next.frameId = sender.frameId;
        }
        request = { ...request, payload: next };
      }
    }

    // Subtitle discovery signals from content scripts cannot know their own
    // tabId/frameId; inject them from the sender so the pipeline dedupes and
    // stores under the correct tab.
    if (request.type === MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL && sender.tab?.id !== undefined) {
      const payload = request.payload as { signal?: { tabId?: number; frameId?: number } } | undefined;
      if (payload?.signal) {
        const signal = { ...payload.signal };
        if (signal.tabId === undefined || signal.tabId === 0) {
          signal.tabId = sender.tab.id;
        }
        if (signal.frameId === undefined || signal.frameId === 0) {
          signal.frameId = sender.frameId ?? 0;
        }
        request = { ...request, payload: { ...payload, signal } };
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
      // _OFFSCREEN_ messages are forwarded by background to the offscreen document.
      // The offscreen listener owns the response. Returning true here would keep
      // the channel open, but handleMessage returns a never-resolving promise for
      // these types (sendResponse never called). Chrome's sendMessage Promise
      // waits for ALL listeners that returned true to call sendResponse — the
      // never-resolving promise hangs sendMessage forever. Return false to close
      // our channel immediately so the offscreen listener can respond.
      if (request.type?.startsWith?.('_OFFSCREEN_')) {
        return false;
      }
      // Respond asynchronously.
      void this.handleMessage(request, sender).then(sendResponse);
      return true;
    };

    this.boundListener = listener;
    // The adapter's onMessage type omits the optional sendResponse param;
    // cast to satisfy the narrower signature without changing runtime behavior.
    onMessage(listener as Parameters<typeof onMessage>[0]);
  }

  /**
   * Stop listening.
   */
  stop(): void {
    if (!this.boundListener) {
      return;
    }
    removeOnMessageListener(this.boundListener);
    this.boundListener = null;
  }
}
