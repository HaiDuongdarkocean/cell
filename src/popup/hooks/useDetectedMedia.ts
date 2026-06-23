import { useEffect } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
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
 * Subscribes to detected media from the background script.
 *
 * On mount it requests the current detected media via `GET_DETECTED_MEDIA`
 * and subscribes to live `DETECTED_MEDIA_UPDATE` broadcasts. The hook returns
 * the latest `{ videos, subtitles }` from the popup store.
 */
export function useDetectedMedia(): {
  videos: DetectedVideo[];
  subtitles: DetectedSubtitle[];
} {
  const videos = usePopupStore((state) => state.videos);
  const subtitles = usePopupStore((state) => state.subtitles);
  const setVideos = usePopupStore((state) => state.setVideos);
  const setSubtitles = usePopupStore((state) => state.setSubtitles);

  useEffect(() => {
    const request: MessageRequest = { type: 'GET_DETECTED_MEDIA' };
    let cancelled = false;

    // Retry sending the message — the service worker may need a moment to
    // wake up and register its listeners ("Receiving end does not exist").
    const sendWithRetry = async (retries = 3, delayMs = 500): Promise<void> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        if (cancelled) return;
        try {
          const response = (await chrome.runtime.sendMessage(
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

    const listener = (
      request: MessageRequest,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response: MessageResponse) => void,
    ): boolean => {
      if (request.type === 'DETECTED_MEDIA_UPDATE') {
        const payload = request.payload as DetectedMediaUpdatePayload;
        if (payload) {
          setVideos(payload.videos);
          setSubtitles(payload.subtitles);
        }
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [setVideos, setSubtitles]);

  return { videos, subtitles };
}
