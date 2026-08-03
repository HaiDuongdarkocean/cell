import { DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS, STATIC_TOKENS } from '@/shared/lib/tokens';

const TOKEN_STYLE_ID = 'cell-token-span-style';

/** Static design tokens that token-span CSS references via var() but that are
 *  NOT loaded on host pages (tokens.css only ships in popup/sidepanel/showcase).
 *  We inject the resolved values here so var() resolves on the host page.
 *  Static tokens are theme-independent, so a single :root block suffices. */
const STATIC_TOKENS_NEEDED: readonly string[] = [
  '--space-0-5',
  '--shadow-sm',
  '--border-width-hairline',
  '--border-width-status',
  '--radius-xs',
  '--duration-100',
  // --overlay-text-rgb is a static token (theme-independent, from tokens.json
  // overlay.text). It's NOT in DEFAULT_LIGHT/DARK_TOKENS (those only have color
  // tokens), so it must be injected from STATIC_TOKENS, not CELL_TOKEN_MAP.
  '--overlay-text-rgb',
];

/** Map cell-token variables to canonical design tokens from tokens.json.
 *  buildVariables() injects the resolved values so every token is SSOT.
 *  Frequency + status đều là absolute hex (1 set cho cả dark & light) —
 *  variant A "Tint vs Solid": pill tint nhạt + underline solid đậm đặc. */
const CELL_TOKEN_MAP: Record<string, string> = {
  // Status bar colors — absolute hex, theme-agnostic (1 set cho cả dark & light).
  // Rendered as inset box-shadow on the token so it survives multi-line fragments.
  '--cell-token-status-unknown': '--color-token-status-unknown',
  '--cell-token-status-tracking': '--color-token-status-tracking',
  '--cell-token-status-known': '--color-token-status-known',
  '--cell-token-status-ignore': '--color-token-status-ignore',
  // Frequency bands — absolute hex tint pill + contrasting fg (variant A).
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

/** Overlay text highlight with a 45% alpha, sourced from the static
 *  `--overlay-text-rgb` token (injected via STATIC_TOKENS_NEEDED). */
const OVERLAY_TEXT_RGBA = 'rgba(var(--overlay-text-rgb), 0.45)';

function buildVariables(): string {
  const lightDecls = Object.entries(CELL_TOKEN_MAP)
    .map(([cellName, designName]) => `  ${cellName}: ${DEFAULT_LIGHT_TOKENS[designName]};`)
    .join('\n');
  const darkDecls = Object.entries(CELL_TOKEN_MAP)
    .map(([cellName, designName]) => `  ${cellName}: ${DEFAULT_DARK_TOKENS[designName]};`)
    .join('\n');
  // Static tokens (spacing/radius/shadow/border-width/motion) are theme-
  // independent; inject once into :root so var() resolves on host pages where
  // tokens.css is never loaded. Without this, the status bar box-shadow
  // (which uses calc(var(--border-width-status) * -1)) is an invalid declaration and
  // silently dropped, leaving the status underline invisible while the
  // frequency band (which only uses --cell-token-* color vars) still shows.
  const staticDecls = STATIC_TOKENS_NEEDED.map((name) => `  ${name}: ${STATIC_TOKENS[name]};`).join('\n');

  return `
:root {
${lightDecls}
${staticDecls}
}

@media (prefers-color-scheme: dark) {
  :root {
${darkDecls}
${staticDecls}
  }
}

[data-theme="light"] {
${lightDecls}
${staticDecls}
}

[data-theme="dark"] {
${darkDecls}
${staticDecls}
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
   Quadruple-specificity (html body .js-cell-token.js-cell-token--frequency-*) = (0,2,2)
   so host pages with high-specificity box-shadow:none!important rules (e.g.
   GeeksforGeeks Next.js resets at (0,2,1)) cannot override our !important.
   Band colors resolve from the injected --cell-token-* variables, which
   cascade from :root, prefers-color-scheme, or a [data-theme] ancestor. */
html body .js-cell-token.js-cell-token--frequency-core {
  background-color: var(--cell-token-freq-core-bg) !important;
  color: var(--cell-token-freq-core-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-core-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-common {
  background-color: var(--cell-token-freq-common-bg) !important;
  color: var(--cell-token-freq-common-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-common-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-general {
  background-color: var(--cell-token-freq-general-bg) !important;
  color: var(--cell-token-freq-general-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-general-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-advanced {
  background-color: var(--cell-token-freq-advanced-bg) !important;
  color: var(--cell-token-freq-advanced-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-advanced-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-rare {
  background-color: var(--cell-token-freq-rare-bg) !important;
  color: var(--cell-token-freq-rare-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-rare-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}

/* Status bar: 3px inset underline in the semantic color plus a 3px overlay-text
   highlight at the same offset. The highlight lightens the underline when the
   status color matches the pill background (e.g. known on a core green token).
   Quadruple-specificity (html body ancestor) so host box-shadow:none!important
   resets (GeeksforGeeks at (0,2,1)) cannot override our !important. */
html body .js-cell-token.js-cell-token--status-unknown {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-unknown),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
html body .js-cell-token.js-cell-token--status-tracking {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-tracking),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
html body .js-cell-token.js-cell-token--status-known {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-known),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
html body .js-cell-token.js-cell-token--status-ignore {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-ignore),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}

/* Text guard removed: the 3px inset status underline no longer needs a halo
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
   Quadruple-specificity (html body ancestor) so host !important color/box-shadow
   rules don't fight back. */
html body .js-cell-token.js-cell-token--status-known,
html body .js-cell-token.js-cell-token--status-ignore {
  --cell-token-guard: currentColor;
  background-color: transparent !important;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
}
html body .js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open),
html body .js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) {
  box-shadow: var(--shadow-sm) !important;
  text-shadow: var(--shadow-sm) !important;
}

/* Ignore is rendered the same as known: no frequency, no status by default,
   status appears on hover. No extra de-emphasis styling is applied. */

/* Global layer toggles (applied per token).
   Quadruple-specificity (html body ancestor) so host box-shadow:none!important
   resets cannot override our !important. */
html body .js-cell-token.js-cell-token--status-off {
  box-shadow: var(--shadow-sm) !important;
  text-shadow: var(--shadow-sm) !important;
}
html body .js-cell-token.js-cell-token--frequency-off {
  --cell-token-guard: currentColor;
  background-color: transparent !important;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
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

/** Build shadow-DOM-compatible token span CSS.
 *  CSS custom properties inherit through shadow boundaries, so `:root`
 *  variables from the host document are available inside the shadow root.
 *  But `html body` ancestor selectors don't match inside shadow DOM,
 *  so frequency/status rules use bare class selectors instead. */
export function buildTokenSpanCssForShadow(): string {
  return `
.js-cell-token {
  display: inline !important;
  vertical-align: baseline !important;
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
  -webkit-text-fill-color: currentColor !important;
  --cell-token-guard: currentColor;
  transition: background-color var(--duration-100) !important;
}

@media (prefers-reduced-motion: reduce) {
  .js-cell-token {
    transition: none !important;
  }
}

.js-cell-token--word {
  display: inline !important;
  background: transparent !important;
  color: inherit !important;
  text-decoration: none !important;
}

.js-cell-token-status {
  display: none !important;
}

.js-cell-token--separator {
  display: inline !important;
  cursor: auto !important;
  background: transparent !important;
  color: inherit !important;
}

.js-cell-token.js-cell-token--frequency-core {
  background-color: var(--cell-token-freq-core-bg) !important;
  color: var(--cell-token-freq-core-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-core-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-common {
  background-color: var(--cell-token-freq-common-bg) !important;
  color: var(--cell-token-freq-common-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-common-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-general {
  background-color: var(--cell-token-freq-general-bg) !important;
  color: var(--cell-token-freq-general-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-general-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-advanced {
  background-color: var(--cell-token-freq-advanced-bg) !important;
  color: var(--cell-token-freq-advanced-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-advanced-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-rare {
  background-color: var(--cell-token-freq-rare-bg) !important;
  color: var(--cell-token-freq-rare-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-rare-fg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}

.js-cell-token.js-cell-token--status-unknown {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-unknown),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-tracking {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-tracking),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-known {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-known),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-ignore {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-ignore),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}

.js-cell-token.js-cell-token--status-unknown,
.js-cell-token.js-cell-token--status-tracking,
.js-cell-token.js-cell-token--status-known:hover,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open,
.js-cell-token.js-cell-token--status-ignore:hover,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open {
  text-shadow: var(--shadow-sm) !important;
}

.js-cell-token.js-cell-token--status-known,
.js-cell-token.js-cell-token--status-ignore {
  --cell-token-guard: currentColor;
  background-color: transparent !important;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
}
.js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open),
.js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) {
  box-shadow: var(--shadow-sm) !important;
  text-shadow: var(--shadow-sm) !important;
}

.js-cell-token.js-cell-token--status-off {
  box-shadow: var(--shadow-sm) !important;
  text-shadow: var(--shadow-sm) !important;
}
.js-cell-token.js-cell-token--frequency-off {
  --cell-token-guard: currentColor;
  background-color: transparent !important;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
}
`.trim();
}
