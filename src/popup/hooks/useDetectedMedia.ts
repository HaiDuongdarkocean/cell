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

    void chrome.runtime
      .sendMessage(request)
      .then((response: MessageResponse<DetectedMediaUpdatePayload>) => {
        if (response?.success && response.data) {
          setVideos(response.data.videos);
          setSubtitles(response.data.subtitles);
        }
      });

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
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [setVideos, setSubtitles]);

  return { videos, subtitles };
}
