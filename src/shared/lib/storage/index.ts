/** OPFS storage adapter (shared infrastructure). */
export { idbRequest } from './idb';
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
