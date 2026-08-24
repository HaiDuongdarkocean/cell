/**
 * SSOT — Extension UI host selectors.
 *
 * All Cell extension UI elements injected into host pages. Text inside these
 * hosts must NOT trigger dictionary lookup, tokenization, or host-page
 * keyboard shortcuts.
 *
 * Consumers:
 * - `webTriggerController.ts` — blocks dictionary popup on click/hover
 * - `subtitleShortcuts.ts` — blocks keyboard shortcuts inside Cell UI
 * - `tokenizeBlock.ts` — blocks tokenization of Cell UI text
 *
 * Three lists derived from this base:
 * - `ALL_EXTENSION_UI_HOSTS` — every host (use for keyboard shortcut blocking)
 * - `DICTIONARY_LOOKUP_BLOCKED_HOSTS` — hosts that block dictionary lookup
 *   (same as ALL + subtitle root; universal panel has `data-allow-lookup`
 *   whitelist for dictionary definitions)
 * - `POINTER_EVENT_DISABLED_HOSTS` — hosts whose pointer-events are temporarily
 *   disabled during caretRangeFromPoint so the resolver sees page text behind
 *   floating UI (excludes universal panel — it contains allowed lookup text)
 */

/** Shadow-DOM hosts — created by mountReactShadow / attachShadow. */
const SHADOW_HOSTS = [
  '#cell-subtitle-root',
  '#cell-manager-portal',
  '#cell-host-manager-sheet',
  '.js-cell-popup-host',
  '.js-cell-orbital-badge-host',
  '.js-cell-token-badge-host',
] as const;

/** Light-DOM hosts — React-rendered text reachable by TreeWalker. */
const LIGHT_HOSTS = [
  '#cell-settings-dialog-host',
  '#cell-card-creator-host',
  '#cell-universal-panel-host',
  '#cell-settings-dialog-host-legacy',
] as const;

/** OCR overlay hosts — light-DOM elements injected by OCR feature. */
const OCR_HOSTS = [
  '.cell-ocr-overlay',
  '.cell-ocr-region-selector',
] as const;

/** All extension UI host selectors — use for keyboard shortcut blocking. */
export const ALL_EXTENSION_UI_HOSTS: readonly string[] = [
  ...SHADOW_HOSTS,
  ...LIGHT_HOSTS,
  ...OCR_HOSTS,
];

/** Hosts that block dictionary lookup (click/hover inside these → no popup).
 *  Same as ALL_EXTENSION_UI_HOSTS — universal panel has `data-allow-lookup`
 *  whitelist for dictionary definitions inside it. */
export const DICTIONARY_LOOKUP_BLOCKED_HOSTS: readonly string[] = [
  ...ALL_EXTENSION_UI_HOSTS,
];

/** Hosts whose pointer-events are temporarily disabled during caret resolution.
 *  Excludes universal panel — it contains allowed lookup text (dictionary
 *  definitions, card creator preview) that the caret resolver must see. */
export const POINTER_EVENT_DISABLED_HOSTS: readonly string[] = [
  '#cell-subtitle-root',
  '#cell-manager-portal',
  '#cell-host-manager-sheet',
  '.js-cell-popup-host',
  '.js-cell-orbital-badge-host',
  '.js-cell-token-badge-host',
  '#cell-settings-dialog-host',
  '#cell-card-creator-host',
  '#cell-settings-dialog-host-legacy',
  ...OCR_HOSTS,
];

/** Hosts that block tokenization — light-DOM hosts only (TreeWalker can't
 *  cross shadow boundaries, but shadow hosts are included for safety).
 *  Excludes subtitle root (subtitle text is handled by subtitle controller).
 *  Universal panel has `data-allow-tokenize` whitelist. */
export const TOKENIZE_BLOCKED_HOSTS: readonly string[] = [
  '#cell-settings-dialog-host',
  '#cell-card-creator-host',
  '#cell-universal-panel-host',
  '#cell-settings-dialog-host-legacy',
  '.js-cell-popup-host',
  '.js-cell-orbital-badge-host',
  '.js-cell-token-badge-host',
  ...OCR_HOSTS,
];

/** CSS selector string for querySelectorAll / closest. */
export const ALL_EXTENSION_UI_HOSTS_SELECTOR = ALL_EXTENSION_UI_HOSTS.join(', ');
export const DICTIONARY_LOOKUP_BLOCKED_HOSTS_SELECTOR = DICTIONARY_LOOKUP_BLOCKED_HOSTS.join(', ');
export const POINTER_EVENT_DISABLED_HOSTS_SELECTOR = POINTER_EVENT_DISABLED_HOSTS.join(', ');
export const TOKENIZE_BLOCKED_HOSTS_SELECTOR = TOKENIZE_BLOCKED_HOSTS.join(', ');
