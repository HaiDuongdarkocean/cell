import { DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS, STATIC_TOKENS, type TokenRecord } from '@/shared/lib/tokens';

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
  '--cell-token-status-learning': '--color-token-status-learning',
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
  // Bulk-selection wash — layered as background-image so the status underline
  // and frequency pill survive underneath (Concept B "water wash").
  '--cell-token-selected': '--color-primary',
};

/** Overlay text highlight with a 45% alpha, sourced from the static
 *  `--overlay-text-rgb` token (injected via STATIC_TOKENS_NEEDED). */
const OVERLAY_TEXT_RGBA = 'rgba(var(--overlay-text-rgb), 0.45)';

function resolveMappedTokenValue(tokens: TokenRecord, designName: string): string {
  const value = tokens[designName] ?? '';
  return value.replace(/var\((--[\w-]+)\)/g, (reference, dependency: string) => tokens[dependency] ?? reference);
}

function buildVariables(rootSelector = ':root'): string {
  const lightDecls = Object.entries(CELL_TOKEN_MAP)
    .map(([cellName, designName]) => `  ${cellName}: ${resolveMappedTokenValue(DEFAULT_LIGHT_TOKENS, designName)};`)
    .join('\n');
  const darkDecls = Object.entries(CELL_TOKEN_MAP)
    .map(([cellName, designName]) => `  ${cellName}: ${resolveMappedTokenValue(DEFAULT_DARK_TOKENS, designName)};`)
    .join('\n');
  // Static tokens (spacing/radius/shadow/border-width/motion) are theme-
  // independent; inject once into :root so var() resolves on host pages where
  // tokens.css is never loaded. Without this, the status bar box-shadow
  // (which uses calc(var(--border-width-status) * -1)) is an invalid declaration and
  // silently dropped, leaving the status underline invisible while the
  // frequency band (which only uses --cell-token-* color vars) still shows.
  const staticDecls = STATIC_TOKENS_NEEDED.map((name) => `  ${name}: ${STATIC_TOKENS[name]};`).join('\n');

  return `
${rootSelector} {
${lightDecls}
${staticDecls}
}

@media (prefers-color-scheme: dark) {
  ${rootSelector} {
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
   margin, or line-height is added so the host page box model is preserved. */
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
  outline: none !important;
  background: transparent !important;
  color: inherit !important;
  font: inherit !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  text-decoration: none !important;
  /* Framer and similar gradient-text hosts set -webkit-text-fill-color: transparent
     on an ancestor (with -webkit-background-clip: text). That property inherits and
     overrides color, making our token text invisible over the pill background.
     Force it back to currentColor so each band color wins. */
  -webkit-text-fill-color: currentColor !important;
  /* Guard color used by text-shadow on status tokens to keep the text legible
     over the inset status underline. Default follows the text color; frequency
     bands override it to the pill background so the halo is invisible. */
  --cell-token-guard: currentColor;
}

/* Each word token is a self-sizing vertical unit: cap lane, word lane, gloss
   lane stacked in flow. The column width is the widest lane, so a long reading
   or gloss widens the whole unit and centers the shorter lanes instead of
   overlapping neighbouring tokens. The lanes always exist (content may be
   empty) and keep their line-height as reserved space, so asynchronously
   resolved metadata never reflows the line — same invariant the old margins
   provided. Annotation-off tokens degrade to a single-item column, visually
   identical to the original inline word. */
html body .js-cell-token--word {
  display: inline-flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 0.15em !important;
}

/* The column's baseline is its first flex item (the cap lane). When the cap
   lane exists, lift the column by the cap-to-word baseline distance so the
   word lands back on the parent text baseline — word alignment stays exact
   relative to any inline ancestor (<a>, <sup>, separators), on both host
   pages and subtitle surfaces. 1.6em = cap lane (0.88em × 1.15) + lane gap
   (0.15em) + word ascent; calibrated on real layout to <0.2px error. */
html body .js-cell-token--word:not(.js-cell-token--reading-off) {
  vertical-align: 1.6em !important;
}

/* The inner span is the word lane of the token column — every painted visual
   (pill background, hairline border, status underline, selected wash, subtle
   drop shadow) targets it so the decoration hugs the word instead of framing
   the annotation lanes above/below. */
.js-cell-token-word {
  display: inline !important;
  background: transparent !important;
  color: inherit !important;
  text-decoration: none !important;
  border-radius: var(--radius-xs) !important;
  box-shadow: var(--shadow-sm) !important;
}

/* Ruby cap (spec reading-annotation): in-flow lane above the word, always
   generated so the reserved headroom exists before data-reading arrives.
   min-height is in the lane's own ems (0.88em font → ~1em of parent). */
html body .js-cell-token--word:not(.js-cell-token--reading-off)::before {
  content: attr(data-reading);
  min-height: 1.15em;
  font-size: 0.88em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: normal;
  font-weight: 500;
  color: inherit;
  opacity: 0.92;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
}

/* Gloss footnote (spec word-translation): in-flow lane below the word — the
   lane's natural width widens the unit instead of overflowing it, so glosses
   never ellipsis and never collide. Never selectable, never copied. */
html body .js-cell-token--word:not(.js-cell-token--gloss-off)::after {
  content: attr(data-gloss);
  min-height: 1.15em;
  font-size: 0.8em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: normal;
  font-weight: 500;
  color: inherit;
  opacity: 0.85;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
}

/* Status span is kept in the DOM for tests/backwards compatibility but the
   visual status bar is rendered as an inset box-shadow on the word lane. */
.js-cell-token-status {
  display: none !important;
}

/* Resolving: tokens are clickable word spans but status/frequency visuals are
   suppressed until metadata resolves, preventing the whole panel from flashing
   as colors pop in. */
html body .js-cell-token.js-cell-token--resolving {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  text-shadow: none !important;
  transition: none !important;
}
html body .js-cell-token.js-cell-token--resolving .js-cell-token-word {
  background-color: transparent !important;
  box-shadow: none !important;
}

.js-cell-token--separator {
  display: inline !important;
  cursor: auto !important;
  background: transparent !important;
  color: inherit !important;
}

/* Frequency bands: contrasting fg on the token column (cap + gloss lanes
   inherit it) while the pill background + hairline paint only the word lane.
   Quadruple-specificity (html body .js-cell-token.js-cell-token--frequency-*)
   so host pages with high-specificity box-shadow:none!important rules (e.g.
   GeeksforGeeks Next.js resets at (0,2,1)) cannot override our !important.
   Band colors resolve from the injected --cell-token-* variables, which
   cascade from :root, prefers-color-scheme, or a [data-theme] ancestor. */
html body .js-cell-token.js-cell-token--frequency-core {
  color: var(--cell-token-freq-core-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-core-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-core .js-cell-token-word {
  background-color: var(--cell-token-freq-core-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-common {
  color: var(--cell-token-freq-common-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-common-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-common .js-cell-token-word {
  background-color: var(--cell-token-freq-common-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-general {
  color: var(--cell-token-freq-general-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-general-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-general .js-cell-token-word {
  background-color: var(--cell-token-freq-general-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-advanced {
  color: var(--cell-token-freq-advanced-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-advanced-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-advanced .js-cell-token-word {
  background-color: var(--cell-token-freq-advanced-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-rare {
  color: var(--cell-token-freq-rare-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-rare-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-rare .js-cell-token-word {
  background-color: var(--cell-token-freq-rare-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}

/* Status bar: 3px inset underline in the semantic color plus a 3px overlay-text
   highlight at the same offset — painted on the word lane so the underline
   hugs the word, not the annotation lanes. The highlight lightens the
   underline when the status color matches the pill background (e.g. known on
   a core green token). Quadruple-specificity (html body ancestor) so host
   box-shadow:none!important resets cannot override our !important. */
html body .js-cell-token.js-cell-token--status-unknown .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-unknown),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
html body .js-cell-token.js-cell-token--status-tracking .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-tracking),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
html body .js-cell-token.js-cell-token--status-learning .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-learning),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
html body .js-cell-token.js-cell-token--status-known:hover:not(.js-cell-token--status-off) .js-cell-token-word,
html body .js-cell-token.js-cell-token--status-known.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-known),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
html body .js-cell-token.js-cell-token--status-ignore:hover:not(.js-cell-token--status-off) .js-cell-token-word,
html body .js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-ignore),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}

/* Text guard removed: the 3px inset status underline no longer needs a halo
   to keep the glyph legible. */
.js-cell-token.js-cell-token--status-unknown,
.js-cell-token.js-cell-token--status-tracking,
.js-cell-token.js-cell-token--status-learning,
.js-cell-token.js-cell-token--status-known:hover,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open,
.js-cell-token.js-cell-token--status-ignore:hover,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open {
  text-shadow: var(--shadow-sm) !important;
}

/* known/ignore render as plain text by default — no status underline, no
   frequency pill. Both layers reveal on hover or while the token's dictionary
   popup is open (.js-cell-token--popup-open). status-off keeps the underline
   hidden even then; frequency-off (global layer toggle) keeps the pill hidden. */
html body .js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open),
html body .js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) {
  --cell-token-guard: currentColor;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  text-shadow: var(--shadow-sm) !important;
}
html body .js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-word,
html body .js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-word {
  background-color: transparent !important;
}

html body .js-cell-token.js-cell-token--selected .js-cell-token-word {
  background-image: linear-gradient(color-mix(in srgb, var(--cell-token-selected) 18%, transparent) 0 0) !important;
}

/* Global layer toggles (applied per token).
   Quadruple-specificity (html body ancestor) so host box-shadow:none!important
   resets cannot override our !important. */
html body .js-cell-token.js-cell-token--status-off {
  text-shadow: var(--shadow-sm) !important;
}
html body .js-cell-token.js-cell-token--status-off .js-cell-token-word {
  box-shadow: var(--shadow-sm) !important;
}
html body .js-cell-token.js-cell-token--frequency-off {
  --cell-token-guard: currentColor;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
}
html body .js-cell-token.js-cell-token--frequency-off .js-cell-token-word {
  background-color: transparent !important;
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
${buildVariables(':host')}

.js-cell-token {
  display: inline !important;
  vertical-align: baseline !important;
  white-space: inherit !important;
  overflow-wrap: break-word !important;
  word-break: normal !important;
  cursor: pointer !important;
  border: none !important;
  outline: none !important;
  background: transparent !important;
  color: inherit !important;
  font: inherit !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  text-decoration: none !important;
  -webkit-text-fill-color: currentColor !important;
  --cell-token-guard: currentColor;
}

/* Self-sizing annotation column — same mechanism as the light-DOM builder:
   cap/word/gloss lanes stacked in flow so the widest lane widens the unit and
   neighbors never overlap. */
.js-cell-token--word {
  display: inline-flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 0.15em !important;
}

/* Column baseline = cap lane baseline; lift by the cap-to-word distance so
   the word lands back on the parent text baseline (see light-DOM rule). */
.js-cell-token--word:not(.js-cell-token--reading-off) {
  vertical-align: 1.6em !important;
}

.js-cell-token-word {
  display: inline !important;
  background: transparent !important;
  color: inherit !important;
  text-decoration: none !important;
  border-radius: var(--radius-xs) !important;
  box-shadow: var(--shadow-sm) !important;
}

/* Ruby cap (spec reading-annotation): in-flow lane above the word — never
   selectable, never copied. */
.js-cell-token--word:not(.js-cell-token--reading-off)::before {
  content: attr(data-reading);
  min-height: 1.15em;
  font-size: 0.88em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: normal;
  font-weight: 500;
  color: inherit;
  opacity: 0.92;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
}

/* Gloss footnote (spec word-translation): in-flow lane below the word — its
   natural width widens the unit so glosses never ellipsis or collide. */
.js-cell-token--word:not(.js-cell-token--gloss-off)::after {
  content: attr(data-gloss);
  min-height: 1.15em;
  font-size: 0.8em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: normal;
  font-weight: 500;
  color: inherit;
  opacity: 0.85;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
}

.js-cell-token-status {
  display: none !important;
}

/* Resolving: suppress status/frequency visuals while metadata is loading. */
.js-cell-token.js-cell-token--resolving {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  text-shadow: none !important;
  transition: none !important;
}
.js-cell-token.js-cell-token--resolving .js-cell-token-word {
  background-color: transparent !important;
  box-shadow: none !important;
}

.js-cell-token--separator {
  display: inline !important;
  cursor: auto !important;
  background: transparent !important;
  color: inherit !important;
}

.js-cell-token.js-cell-token--frequency-core {
  color: var(--cell-token-freq-core-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-core-fg) !important;
}
.js-cell-token.js-cell-token--frequency-core .js-cell-token-word {
  background-color: var(--cell-token-freq-core-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-common {
  color: var(--cell-token-freq-common-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-common-fg) !important;
}
.js-cell-token.js-cell-token--frequency-common .js-cell-token-word {
  background-color: var(--cell-token-freq-common-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-general {
  color: var(--cell-token-freq-general-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-general-fg) !important;
}
.js-cell-token.js-cell-token--frequency-general .js-cell-token-word {
  background-color: var(--cell-token-freq-general-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-advanced {
  color: var(--cell-token-freq-advanced-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-advanced-fg) !important;
}
.js-cell-token.js-cell-token--frequency-advanced .js-cell-token-word {
  background-color: var(--cell-token-freq-advanced-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-rare {
  color: var(--cell-token-freq-rare-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-rare-fg) !important;
}
.js-cell-token.js-cell-token--frequency-rare .js-cell-token-word {
  background-color: var(--cell-token-freq-rare-bg) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}

.js-cell-token.js-cell-token--status-unknown .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-unknown),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-tracking .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-tracking),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-learning .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-learning),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-known:hover:not(.js-cell-token--status-off) .js-cell-token-word,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-known),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}
.js-cell-token.js-cell-token--status-ignore:hover:not(.js-cell-token--status-off) .js-cell-token-word,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-word {
  box-shadow:
    inset 0 calc(var(--border-width-status) * -1) 0 0 var(--cell-token-status-ignore),
    inset 0 calc(var(--border-width-status) * -1) 0 0 ${OVERLAY_TEXT_RGBA} !important;
}

.js-cell-token.js-cell-token--status-unknown,
.js-cell-token.js-cell-token--status-tracking,
.js-cell-token.js-cell-token--status-learning,
.js-cell-token.js-cell-token--status-known:hover,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open,
.js-cell-token.js-cell-token--status-ignore:hover,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open {
  text-shadow: var(--shadow-sm) !important;
}

.js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open),
.js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) {
  --cell-token-guard: currentColor;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  text-shadow: var(--shadow-sm) !important;
}
.js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-word,
.js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-word {
  background-color: transparent !important;
}

.js-cell-token.js-cell-token--selected .js-cell-token-word {
  background-image: linear-gradient(color-mix(in srgb, var(--cell-token-selected) 18%, transparent) 0 0) !important;
}

.js-cell-token.js-cell-token--status-off {
  text-shadow: var(--shadow-sm) !important;
}
.js-cell-token.js-cell-token--status-off .js-cell-token-word {
  box-shadow: var(--shadow-sm) !important;
}
.js-cell-token.js-cell-token--frequency-off {
  --cell-token-guard: currentColor;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
}
.js-cell-token.js-cell-token--frequency-off .js-cell-token-word {
  background-color: transparent !important;
}
`.trim();
}
