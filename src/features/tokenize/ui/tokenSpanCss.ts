import tokensJson from '@/shared/styles/tokens.json';
import { DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS } from '@/shared/lib/tokens';
import { hexToRgb } from '@/features/theme/logic/colorGenerator';

const TOKEN_STYLE_ID = 'cell-token-span-style';

/** Map cell-token variables to canonical design tokens from tokens.json.
 *  buildVariables() injects the resolved values so every token is SSOT. */
const CELL_TOKEN_MAP: Record<string, string> = {
  // Status bar colors (semantic DS colors). The bar is rendered as an inset
  // box-shadow on the token so it survives multi-line inline fragments.
  '--cell-token-status-unknown': '--color-error',
  '--cell-token-status-tracking': '--color-warning',
  '--cell-token-status-known': '--color-success',
  '--cell-token-status-ignore': '--color-text-muted',
  // Soft Tonal frequency bands: dedicated tokens in tokens.json.
  // Light mode uses muted pastel backgrounds with dark text.
  // Dark mode uses a single slate container with soft pastel text
  // to reduce eye strain and avoid the saturated M3 dark container colors.
  '--cell-token-freq-core-bg': '--color-token-freq-core-bg',
  '--cell-token-freq-core-fg': '--color-token-freq-core-fg',
  '--cell-token-freq-common-bg': '--color-token-freq-common-bg',
  '--cell-token-freq-common-fg': '--color-token-freq-common-fg',
  '--cell-token-freq-general-bg': '--color-token-freq-general-bg',
  '--cell-token-freq-general-fg': '--color-token-freq-general-fg',
  '--cell-token-freq-advanced-bg': '--color-token-freq-advanced-bg',
  '--cell-token-freq-advanced-fg': '--color-token-freq-advanced-fg',
  '--cell-token-freq-rare-bg': '--color-token-freq-rare-bg',
  '--cell-token-freq-rare-fg': '--color-token-freq-rare-fg',
  '--cell-token-freq-border': '--color-token-freq-border',
};

/** Static overlay text token used for the white status-bar highlight. */
const OVERLAY_TEXT = tokensJson.static.overlay.text;
const { r: otR, g: otG, b: otB } = hexToRgb(OVERLAY_TEXT);
const OVERLAY_TEXT_RGBA = `rgba(${otR}, ${otG}, ${otB}, 0.45)`;

function buildVariables(): string {
  const lightDecls = Object.entries(CELL_TOKEN_MAP)
    .map(([cellName, designName]) => `  ${cellName}: ${DEFAULT_LIGHT_TOKENS[designName]};`)
    .join('\n');
  const darkDecls = Object.entries(CELL_TOKEN_MAP)
    .map(([cellName, designName]) => `  ${cellName}: ${DEFAULT_DARK_TOKENS[designName]};`)
    .join('\n');

  return `
:root {
${lightDecls}
}

@media (prefers-color-scheme: dark) {
  :root {
${darkDecls}
  }
}

[data-theme="light"] {
${lightDecls}
}

[data-theme="dark"] {
${darkDecls}
}
`.trim();
}

export function buildTokenSpanCss(): string {
  return `
${buildVariables()}

/* Tokens are wrapped inline and kept visually lightweight.  No padding,
   margin, or line-height is added so the host page box model is preserved.
   box-decoration-break: clone ensures a multi-line token still gets styled
   per line fragment. */
.js-cell-token {
  display: inline !important;
  vertical-align: baseline !important;
  /* Inherit the host page's white-space instead of forcing "normal". Forcing
     "normal" breaks hosts that use white-space:nowrap to keep text on one line
     (e.g. GeeksforGeeks #secondarySubHeader nav links) — the token spans would
     wrap and expand the container height. Inherit matches the original text
     node behavior exactly. */
  white-space: inherit !important;
  overflow-wrap: break-word !important;
  word-break: normal !important;
  cursor: pointer !important;
  border: none !important;
  border-radius: var(--radius-xs) !important;
  outline: none !important;
  box-shadow: var(--shadow-sm) !important;
  background: transparent !important;
  color: inherit !important;
  font: inherit !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  text-decoration: none !important;
  -webkit-box-decoration-break: clone !important;
  box-decoration-break: clone !important;
  /* Framer and similar gradient-text hosts set -webkit-text-fill-color: transparent
     on an ancestor (with -webkit-background-clip: text). That property inherits and
     overrides color, making our token text invisible over the pill background.
     Force it back to currentColor so each band color wins. */
  -webkit-text-fill-color: currentColor !important;
  /* Guard color used by text-shadow on status tokens to keep the text legible
     over the inset status underline. Default follows the text color; frequency
     bands override it to the pill background so the halo is invisible. */
  --cell-token-guard: currentColor;
  transition: background-color var(--duration-100) !important;
}

@media (prefers-reduced-motion: reduce) {
  .js-cell-token {
    transition: none !important;
  }
}

.js-cell-token--word {
  /* word-level wrapper; children inherit alignment */
}

.js-cell-token-word {
  display: inline !important;
  background: transparent !important;
  color: inherit !important;
  text-decoration: none !important;
}

/* Status span is kept in the DOM for tests/backwards compatibility but the
   visual status bar is rendered as an inset box-shadow on the token itself
   so it follows multi-line fragments via box-decoration-break. */
.js-cell-token-status {
  display: none !important;
}

.js-cell-token--separator {
  display: inline !important;
  cursor: auto !important;
  background: transparent !important;
  color: inherit !important;
}

/* Frequency bands: solid pill background + contrasting text.
   Double-class (.js-cell-token.js-cell-token--frequency-*) raises specificity
   to (0,2,0) so host pages with high-specificity color rules (e.g. Framer's
   [data-framer-component-type=Text] span span span at (0,1,3)) cannot
   override our !important even if they add !important themselves.
   Band colors resolve from the injected --cell-token-* variables, which
   cascade from :root, prefers-color-scheme, or a [data-theme] ancestor. */
.js-cell-token.js-cell-token--frequency-core {
  background-color: var(--cell-token-freq-core-bg) !important;
  color: var(--cell-token-freq-core-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-common {
  background-color: var(--cell-token-freq-common-bg) !important;
  color: var(--cell-token-freq-common-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-general {
  background-color: var(--cell-token-freq-general-bg) !important;
  color: var(--cell-token-freq-general-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-advanced {
  background-color: var(--cell-token-freq-advanced-bg) !important;
  color: var(--cell-token-freq-advanced-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-rare {
  background-color: var(--cell-token-freq-rare-bg) !important;
  color: var(--cell-token-freq-rare-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}

/* Status bar: 2px inset underline in the semantic color plus a 2px white
   highlight at the same offset. The highlight lightens the underline when the
   status color matches the pill background (e.g. known on a core green token).
   Double-class specificity so host box-shadow rules don't override. */
.js-cell-token.js-cell-token--status-unknown {
  box-shadow:
    inset 0 calc(var(--space-0-5) * -1) 0 0 var(--cell-token-status-unknown),
    inset 0 calc(var(--space-0-5) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-tracking {
  box-shadow:
    inset 0 calc(var(--space-0-5) * -1) 0 0 var(--cell-token-status-tracking),
    inset 0 calc(var(--space-0-5) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-known {
  box-shadow:
    inset 0 calc(var(--space-0-5) * -1) 0 0 var(--cell-token-status-known),
    inset 0 calc(var(--space-0-5) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-ignore {
  box-shadow:
    inset 0 calc(var(--space-0-5) * -1) 0 0 var(--cell-token-status-ignore),
    inset 0 calc(var(--space-0-5) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}

/* Text guard removed: the 2px inset status underline no longer needs a halo
   to keep the glyph legible. */
.js-cell-token.js-cell-token--status-unknown,
.js-cell-token.js-cell-token--status-tracking,
.js-cell-token.js-cell-token--status-known:hover,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open,
.js-cell-token.js-cell-token--status-ignore:hover,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open {
  text-shadow: var(--shadow-sm) !important;
}

/* known/ignore hide frequency and status by default; hover reveals status when
   the status layer is on. A popup-open pin keeps status visible while the popup
   is open. Frequency reappears for unknown/tracking.
   Double-class specificity so host !important color rules don't fight back. */
.js-cell-token.js-cell-token--status-known,
.js-cell-token.js-cell-token--status-ignore {
  --cell-token-guard: currentColor;
  background-color: transparent !important;
  color: inherit !important;
}
.js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open),
.js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) {
  box-shadow: var(--shadow-sm) !important;
  text-shadow: var(--shadow-sm) !important;
}

/* Ignore is rendered the same as known: no frequency, no status by default,
   status appears on hover. No extra de-emphasis styling is applied. */

/* Global layer toggles (applied per token) */
.js-cell-token.js-cell-token--status-off {
  box-shadow: var(--shadow-sm) !important;
  text-shadow: var(--shadow-sm) !important;
}
.js-cell-token.js-cell-token--frequency-off {
  --cell-token-guard: currentColor;
  background-color: transparent !important;
  color: inherit !important;
}
`.trim();
}

/** Inject token-span style into the host document head (idempotent). */
export function injectTokenSpanStyle(): void {
  if (document.getElementById(TOKEN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOKEN_STYLE_ID;
  style.textContent = buildTokenSpanCss();
  (document.head ?? document.documentElement).appendChild(style);
}
