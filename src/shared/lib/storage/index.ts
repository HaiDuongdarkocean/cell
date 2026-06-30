/** OPFS storage adapter (shared infrastructure). */
export {
  ensureDownloadSubdir,
  readFile,
  createOpfsWriter,
  deleteFile,
  cleanupOrphanedDownloads,
  isOpfsAvailable,
  writeJsonFile,
  readJsonFile,
} from './opfsStorage';
