/**
 * Download feature — download queue, downloader, auto-download, media selection.
 *
 * Public API:
 * - Downloader (class) — fetch + transmux + save pipeline
 * - DownloadQueue (class) — queue management with concurrency
 * - selectBestMedia, QUALITY_RANK — auto-select best media per prefs
 * - autoDownload — whitelist-driven auto-download orchestration
 */
export * from './downloader';
export * from './downloadQueue';
export * from './selectBestMedia';
export * from './autoDownload';
