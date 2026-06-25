import { useEffect, useMemo, useRef } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import { getActiveContentTabId } from '@/popup/utils/getActiveContentTab';
import type { DownloadItem } from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  DownloadProgressUpdatePayload,
  DownloadListResponse,
} from '@/types/message';

/**
 * Subscribes to download progress updates from the background script, scoped
 * to the active tab.
 *
 * On mount it queries the active browser tab, stores its id, then requests
 * the current downloads for that tab via `GET_DOWNLOAD_PROGRESS { tabId }`.
 * This ensures downloads persist across popup reopens — when the popup is
 * closed and reopened for the same tab, previously started downloads are
 * still visible. Live `DOWNLOAD_PROGRESS_UPDATE` broadcasts are filtered by
 * `tabId` so progress from other tabs does not leak into this popup.
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
  const setDownloads = usePopupStore((state) => state.setDownloads);

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
      if (request.type === 'DOWNLOAD_PROGRESS_UPDATE') {
        const payload = request.payload as DownloadProgressUpdatePayload;
        // Only apply updates for the active tab; ignore other tabs.
        if (payload?.progress && payload.tabId === tabIdRef.current) {
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
              tabId: tabIdRef.current ?? 0,
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

    // Query the active *content* tab (skips chrome-extension app-windows,
    // e.g. Edge's dictionary sidebar — see getActiveContentTab), then fetch
    // existing downloads for that tab so they persist across popup reopens.
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
        return;
      }

      // Fetch existing downloads for this tab from the background.
      const request: MessageRequest = {
        type: 'GET_DOWNLOAD_PROGRESS',
        payload: { tabId: activeTabId },
      };

      try {
        const response = (await chrome.runtime.sendMessage(
          request,
        )) as MessageResponse<DownloadListResponse> | undefined;
        if (cancelled) return;
        if (response?.success && response.data?.downloads) {
          setDownloads(response.data.downloads);
        }
      } catch {
        // Service worker may be waking up; ignore — live updates will fill in.
      }
    };

    void init();

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [updateDownload, addDownload, setDownloads]);

  const totalProgress = useMemo(() => {
    if (downloads.length === 0) {
      return 0;
    }
    const sum = downloads.reduce((acc, d) => acc + d.progress, 0);
    return sum / downloads.length;
  }, [downloads]);

  return { downloads, totalProgress };
}
