/**
 * Download feature — download queue, downloader, auto-download, media selection.
 *
 * Public API:
 * - Downloader (class) — fetch + transmux + save pipeline
 * - DownloadQueue (class) — queue management with concurrency
 * - selectBestMedia, QUALITY_RANK — auto-select best media per prefs
 * - autoDownload — whitelist-driven auto-download orchestration
 */
export {
  buildFetchHeaders,
  Downloader,
  type ConvertCallback,
  type ConvertResult,
  type ProgressCallback,
  type SaveOpfsFileCallback,
} from './downloader';
export { DownloadQueue, type DownloadExecutor } from './downloadQueue';
export { QUALITY_RANK, selectBestMedia } from './selectBestMedia';
export { tryAutoDownload, type AutoDownloadDeps } from './autoDownload';
