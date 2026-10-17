import { useEffect, useRef } from 'react';
import { getActiveContentTabId } from '@/entrypoints/popup/utils/getActiveContentTab';
import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis';
import { messagePayload } from '@/entities/message/payload';
import type {
  MessageRequest,
  MessageResponse,
  MessageType,
} from '@/entities/message';

const RETRY_DELAY_MS = 500;

export function useActiveTabSubscription<TUpdate, TFetch>(opts: {
  updateType: MessageType;
  onUpdate: (payload: TUpdate) => void;
  fetchType: MessageType;
  onFetch: (data: TFetch) => void;
  retries?: number;
}): void {
  const { updateType, fetchType, retries = 1 } = opts;
  const callbacksRef = useRef({ onUpdate: opts.onUpdate, onFetch: opts.onFetch });
  callbacksRef.current = { onUpdate: opts.onUpdate, onFetch: opts.onFetch };

  useEffect(() => {
    let cancelled = false;
    const tabIdRef = { current: undefined as number | undefined };

    const listener = (
      request: MessageRequest,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response: MessageResponse) => void,
    ): boolean => {
      if (request.type === updateType) {
        const payload = messagePayload<TUpdate & { tabId?: number }>(
          request,
          updateType,
        );
        if (payload && payload.tabId === tabIdRef.current) {
          callbacksRef.current.onUpdate(payload);
        }
      }
      return false;
    };

    onMessage(listener as unknown as Parameters<typeof onMessage>[0]);

    const init = async (): Promise<void> => {
      let activeTabId: number | undefined;
      try {
        activeTabId = await getActiveContentTabId();
      } catch {}

      if (cancelled) return;
      tabIdRef.current = activeTabId;
      if (activeTabId === undefined) return;

      const request: MessageRequest = {
        type: fetchType,
        payload: { tabId: activeTabId },
      };

      for (let attempt = 0; attempt < retries; attempt++) {
        if (cancelled) return;
        try {
          const response = (await sendMessage(request)) as
            | MessageResponse<TFetch>
            | undefined;
          if (cancelled) return;
          if (response?.success && response.data !== undefined) {
            callbacksRef.current.onFetch(response.data);
          }
          return;
        } catch {
          if (attempt < retries - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      removeOnMessageListener(
        listener as unknown as Parameters<typeof removeOnMessageListener>[0],
      );
    };
  }, [updateType, fetchType, retries]);
}
