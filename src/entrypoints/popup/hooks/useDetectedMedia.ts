import { useEffect, useRef } from 'react';
import { usePopupStore } from '@/entrypoints/popup/store/popupStore';
import { getActiveContentTabId } from '@/entrypoints/popup/utils/getActiveContentTab';
import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis';
import type {
  DetectedVideo,
  DetectedSubtitle,
} from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  DetectedMediaUpdatePayload,
} from '@/types/message';

/**
 * Subscribes to detected media from the background script, scoped to the
 * active tab.
 *
 * On mount it queries the active browser tab, stores its id, then requests
 * the current detected media via `GET_DETECTED_MEDIA` (passing the tabId so
 * the background returns only that tab's media). It also subscribes to live
 * `DETECTED_MEDIA_UPDATE` broadcasts and ignores any whose `tabId` does not
 * match the active tab — this prevents media from background tabs leaking
 * into the popup of the focused tab.
 *
 * The hook returns the latest `{ videos, subtitles }` from the popup store.
 */
export function useDetectedMedia(): {
  videos: DetectedVideo[];
  subtitles: DetectedSubtitle[];
} {
  const videos = usePopupStore((state) => state.videos);
  const subtitles = usePopupStore((state) => state.subtitles);
  const setVideos = usePopupStore((state) => state.setVideos);
  const setSubtitles = usePopupStore((state) => state.setSubtitles);

  // Keep the active tabId in a ref so the broadcast listener (created once)
  // always reads the latest value without re-subscribing.
  const tabIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const listener = (
      request: MessageRequest,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response: MessageResponse) => void,
    ): boolean => {
      if (request.type === 'DETECTED_MEDIA_UPDATE') {
        const payload = request.payload as DetectedMediaUpdatePayload;
        // Only apply updates for the active tab; ignore background tabs.
        if (payload && payload.tabId === tabIdRef.current) {
          setVideos(payload.videos);
          setSubtitles(payload.subtitles);
        }
      }
      return false;
    };

    onMessage(listener as unknown as Parameters<typeof onMessage>[0]);

    // Query the active *content* tab (skips chrome-extension app-windows,
    // e.g. Edge's dictionary sidebar — see getActiveContentTab), then send
    // GET_DETECTED_MEDIA scoped to that tab.
    const init = async (): Promise<void> => {
      let activeTabId: number | undefined;
      try {
        activeTabId = await getActiveContentTabId();
      } catch {
        // leave activeTabId undefined
      }

      if (cancelled) return;
      tabIdRef.current = activeTabId;

      if (activeTabId === undefined) {
        // No active content tab → nothing to fetch. Leave the store empty.
        return;
      }

      const request: MessageRequest = {
        type: 'GET_DETECTED_MEDIA',
        payload: { tabId: activeTabId },
      };

      // Retry sending the message — the service worker may need a moment to
      // wake up and register its listeners ("Receiving end does not exist").
      const sendWithRetry = async (
        retries = 3,
        delayMs = 500,
      ): Promise<void> => {
        for (let attempt = 0; attempt < retries; attempt++) {
          if (cancelled) return;
          try {
            const response = (await sendMessage(
              request,
            )) as MessageResponse<DetectedMediaUpdatePayload>;
            if (cancelled) return;
            if (response?.success && response.data) {
              setVideos(response.data.videos);
              setSubtitles(response.data.subtitles);
            }
            return; // success — stop retrying
          } catch {
            if (attempt < retries - 1) {
              await new Promise((r) => setTimeout(r, delayMs));
            }
          }
        }
      };

      void sendWithRetry();
    };

    void init();

    return () => {
      cancelled = true;
      removeOnMessageListener(listener as unknown as Parameters<typeof removeOnMessageListener>[0]);
    };
  }, [setVideos, setSubtitles]);

  return { videos, subtitles };
}
