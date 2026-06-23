import { useEffect, useMemo } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import type { DownloadItem } from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  DownloadProgressUpdatePayload,
} from '@/types/message';

/**
 * Subscribes to download progress updates from the background script.
 *
 * Returns the current list of downloads plus an aggregate `totalProgress`
 * value (the average progress across all downloads, or 0 when there are none).
 */
export function useDownloadProgress(): {
  downloads: DownloadItem[];
  totalProgress: number;
} {
  const downloads = usePopupStore((state) => state.downloads);
  const updateDownload = usePopupStore((state) => state.updateDownload);

  useEffect(() => {
    const listener = (
      request: MessageRequest,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response: MessageResponse) => void,
    ): boolean => {
      if (request.type === 'DOWNLOAD_PROGRESS_UPDATE') {
        const payload = request.payload as DownloadProgressUpdatePayload;
        if (payload?.progress) {
          const { itemId, status, progress, error } = payload.progress;
          updateDownload(itemId, {
            status,
            progress,
            ...(error !== undefined ? { error } : {}),
          });
        }
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [updateDownload]);

  const totalProgress = useMemo(() => {
    if (downloads.length === 0) {
      return 0;
    }
    const sum = downloads.reduce((acc, d) => acc + d.progress, 0);
    return sum / downloads.length;
  }, [downloads]);

  return { downloads, totalProgress };
}
