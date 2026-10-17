import { useMemo } from 'react';
import { usePopupStore } from '@/entrypoints/popup/store/popupStore';
import type { DownloadItem } from '@/entities/media';
import type {
  DownloadProgressUpdatePayload,
  DownloadListResponse,
} from '@/entities/message';
import { t } from '@/shared/i18n';
import { useActiveTabSubscription } from './useActiveTabSubscription';

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

  useActiveTabSubscription<DownloadProgressUpdatePayload, DownloadListResponse>({
    updateType: 'DOWNLOAD_PROGRESS_UPDATE',
    onUpdate: (payload) => {
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

      const exists = usePopupStore
        .getState()
        .downloads.some((d) => d.id === itemId);
      if (!exists) {
        addDownload({
          id: itemId,
          mediaType: 'subtitle',
          url: '',
          title: t('downloads.item.fallbackTitle'),
          tabId: payload.tabId ?? 0,
          startedAt: Date.now(),
          ...patch,
        });
      } else {
        updateDownload(itemId, patch);
      }
    },
    fetchType: 'GET_DOWNLOAD_PROGRESS',
    onFetch: (data) => {
      if (data.downloads) {
        setDownloads(data.downloads);
      }
    },
  });

  const totalProgress = useMemo(() => {
    if (downloads.length === 0) {
      return 0;
    }
    const sum = downloads.reduce((acc, d) => acc + d.progress, 0);
    return sum / downloads.length;
  }, [downloads]);

  return { downloads, totalProgress };
}
