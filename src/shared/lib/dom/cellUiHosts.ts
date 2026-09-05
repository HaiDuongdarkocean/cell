/**
 * Cell extension UI host selectors — SSOT.
 *
 * Every surface the extension renders into a page (shadow hosts, light-DOM
 * mounts, and inner component roots) must be reachable through these
 * selectors so lookup/tokenize/shortcut code can tell "extension UI" apart
 * from host-page content.
 *
 * - `.js-cell-*` classes are JS hooks (behavior), never styling.
 * - `#cell-*-host` ids mark the outer shadow host elements.
 * - `.js-cell-universal-panel` marks the Universal Panel's own root INSIDE
 *   the shadow tree, so `closest()` checks still work across the shadow
 *   boundary and in light-DOM mounts (e.g. the design-system showcase).
 */
export const CELL_UI_HOST_SELECTORS =
  '.js-cell-popup-host, .js-cell-orbital-badge-host, .js-cell-token-badge-host, ' +
  '.js-cell-universal-panel, ' +
  '#cell-settings-dialog-host, #cell-card-creator-host, #cell-universal-panel-host, ' +
  '#cell-subtitle-root';

/**
 * Hosts whose pointer-events get temporarily disabled while resolving a
 * caret position with `caretRangeFromPoint`. The universal panel is excluded
 * on purpose: it is not a floating overlay over page text and contains
 * allow-lookup regions (dictionary definitions, card creator preview).
 */
export const CELL_UI_POINTER_EVENT_HOST_SELECTORS =
  '.js-cell-popup-host, .js-cell-orbital-badge-host, .js-cell-token-badge-host, ' +
  '#cell-settings-dialog-host, #cell-card-creator-host, #cell-subtitle-root';
