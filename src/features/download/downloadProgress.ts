import type { DownloadProgress } from '@/entities/media';

/**
 * Build the DownloadProgress payload reported for a download step.
 *
 * Sets downloadProgress / convertProgress based on the current phase.
 * During 'downloading': downloadProgress = progress, convertProgress = 0.
 * During 'converting': downloadProgress = 100, convertProgress is NOT set
 *   here — the offscreen document broadcasts actual convert progress via
 *   CONVERSION_PROGRESS_UPDATE, which the background relays with
 *   convertProgress set. For subtitles (no offscreen), convertProgress
 *   stays undefined and DownloadCard renders single-phase (acceptable
 *   since subtitle conversion is instant).
 * During 'done': both = 100.
 */
export function buildDownloadProgress(
  itemId: string,
  status: DownloadProgress['status'],
  progress: number,
  options: {
    currentSegment?: number;
    totalSegments?: number;
    fileSize?: number;
    downloadedBytes?: number;
  } = {},
): DownloadProgress {
  const downloadProgress =
    status === 'downloading' ? progress :
    status === 'converting' || status === 'done' ? 100 :
    undefined;
  const convertProgress =
    status === 'done' ? 100 :
    undefined;
  return {
    itemId,
    status,
    progress,
    currentSegment: options.currentSegment,
    totalSegments: options.totalSegments,
    ...(options.fileSize !== undefined ? { fileSize: options.fileSize } : {}),
    ...(options.downloadedBytes !== undefined ? { downloadedBytes: options.downloadedBytes } : {}),
    ...(downloadProgress !== undefined ? { downloadProgress } : {}),
    ...(convertProgress !== undefined ? { convertProgress } : {}),
  };
}
