/**
 * Whitelist feature — auto-download URL whitelist (chrome.storage CRUD).
 *
 * Public API:
 * - isWhitelisted, getWhitelist, addToWhitelist, removeFromWhitelist
 * - normalizeUrl (URL normalization for whitelist comparison)
 * - addCurrentTabToWhitelist, isCurrentTabWhitelisted (tab helpers)
 */
export {
  isWhitelisted,
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  normalizeUrl,
} from './whitelist';
