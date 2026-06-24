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
  const addDownload = usePopupStore((state) => state.addDownload);

  useEffect(() => {
    const listener = (
      request: MessageRequest,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response: MessageResponse) => void,
    ): boolean => {
      if (request.type === 'DOWNLOAD_PROGRESS_UPDATE') {
        const payload = request.payload as DownloadProgressUpdatePayload;
        if (payload?.progress) {
          const {
            itemId,
            status,
            progress,
            error,
            fileSize,
            downloadedBytes,
            processedBytes,
            conversionPhase,
            workerCount,
            usedWorkers,
            currentSegment,
            totalSegments,
            downloadProgress,
            convertProgress,
          } = payload.progress;

          // Build the update patch with all available fields
          const patch = {
            status,
            progress,
            ...(error !== undefined ? { error } : {}),
            ...(fileSize !== undefined ? { fileSize } : {}),
            ...(downloadedBytes !== undefined ? { downloadedBytes } : {}),
            ...(processedBytes !== undefined ? { processedBytes } : {}),
            ...(conversionPhase !== undefined ? { conversionPhase } : {}),
            ...(workerCount !== undefined ? { workerCount } : {}),
            ...(usedWorkers !== undefined ? { usedWorkers } : {}),
            ...(currentSegment !== undefined ? { currentSegment } : {}),
            ...(totalSegments !== undefined ? { totalSegments } : {}),
            ...(downloadProgress !== undefined ? { downloadProgress } : {}),
            ...(convertProgress !== undefined ? { convertProgress } : {}),
          };

          // If this download isn't in the store yet, add a stub entry so the
          // popup can display progress/error state. This handles cases where
          // the download was started by DOWNLOAD_ALL or the addDownload call
          // from the popup hasn't been processed yet.
          const exists = usePopupStore
            .getState()
            .downloads.some((d) => d.id === itemId);
          if (!exists) {
            addDownload({
              id: itemId,
              mediaType: 'subtitle',
              url: '',
              title: 'Download',
              startedAt: Date.now(),
              ...patch,
            });
          } else {
            updateDownload(itemId, patch);
          }
        }
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [updateDownload, addDownload]);

  const totalProgress = useMemo(() => {
    if (downloads.length === 0) {
      return 0;
    }
    const sum = downloads.reduce((acc, d) => acc + d.progress, 0);
    return sum / downloads.length;
  }, [downloads]);

  return { downloads, totalProgress };
}
