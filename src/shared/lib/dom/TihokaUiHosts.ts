/**
 * Tihoka extension UI host selectors — SSOT.
 *
 * Every surface the extension renders into a page (shadow hosts, light-DOM
 * mounts, and inner component roots) must be reachable through these
 * selectors so lookup/tokenize/shortcut code can tell "extension UI" apart
 * from host-page content.
 *
 * - `.js-Tihoka-*` classes are JS hooks (behavior), never styling.
 * - `#Tihoka-*-host` ids mark the outer shadow host elements.
 * - `.js-Tihoka-universal-panel` marks the Universal Panel's own root INSIDE
 *   the shadow tree, so `closest()` checks still work across the shadow
 *   boundary and in light-DOM mounts (e.g. the design-system showcase).
 */
export const Tihoka_UI_HOST_SELECTORS =
  '.js-Tihoka-popup-host, .js-Tihoka-orbital-badge-host, .js-Tihoka-token-badge-host, ' +
  '.js-Tihoka-universal-panel, ' +
  '#Tihoka-settings-dialog-host, #Tihoka-card-creator-host, #Tihoka-universal-panel-host, ' +
  '#Tihoka-subtitle-root';

/**
 * Hosts whose pointer-events get temporarily disabled while resolving a
 * caret position with `caretRangeFromPoint`. The universal panel is excluded
 * on purpose: it is not a floating overlay over page text and contains
 * allow-lookup regions (dictionary definitions, card creator preview).
 */
export const Tihoka_UI_POINTER_EVENT_HOST_SELECTORS =
  '.js-Tihoka-popup-host, .js-Tihoka-orbital-badge-host, .js-Tihoka-token-badge-host, ' +
  '#Tihoka-settings-dialog-host, #Tihoka-card-creator-host, #Tihoka-subtitle-root';

/**
 * Floating Tihoka surfaces that sit above the Universal Panel overlay — a
 * pointerdown inside them must not count as "outside the panel" for the
 * badge's dismiss guard. `#Tihoka-subtitle-root` is deliberately absent:
 * clicking a subtitle word while the panel is open dismisses the panel so
 * the resulting below-panel popup becomes visible.
 */
export const Tihoka_PANEL_DISMISS_EXEMPT_SELECTORS =
  '.js-Tihoka-popup-host, .js-Tihoka-orbital-badge-host, .js-Tihoka-token-badge-host, ' +
  '#Tihoka-settings-dialog-host, #Tihoka-card-creator-host';

export const UNIVERSAL_PANEL_HOST_ID = 'Tihoka-universal-panel-host';

export function isInsideUniversalPanelHost(node: Node): boolean {
  let current: Node = node;
  for (;;) {
    const root = current.getRootNode();
    if (!(root instanceof ShadowRoot)) return false;
    const host = root.host;
    if (host instanceof HTMLElement && host.id === UNIVERSAL_PANEL_HOST_ID) return true;
    current = host;
  }
}
