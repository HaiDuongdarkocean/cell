import { DEFAULT_LIGHT_TOKENS, STATIC_TOKENS, type TokenRecord } from '@/shared/lib/tokens';
import { loadThemeConfig, DEFAULT_THEME_CONFIG } from '@/features/theme';
import { onStorageChanged } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';

const TOKEN_STYLE_ID = 'cell-token-span-style';
const SENTENCE_WASH_VAR = '--cell-sentence-wash';
const SENTENCE_WASH_STYLE_ID = 'cell-sentence-wash-var';
let sentenceWashSyncStarted = false;

/** Static design tokens that token-span CSS references via var() but that are
 *  NOT loaded on host pages (tokens.css only ships in popup/sidepanel/showcase).
 *  We inject the resolved values here so var() resolves on the host page.
 *  Static tokens are theme-independent, so a single :root block suffices. */
const STATIC_TOKENS_NEEDED: readonly string[] = [
  '--space-0-5',
  '--shadow-sm',
  '--border-width-hairline',
  '--border-width-status',
  '--radius-md',
  '--duration-100',
  // Full z-overlay ladder: host-page mount hosts resolve var(--z-overlay-*) inline; unresolved vars → auto → later DOM overlays win.
  '--z-overlay-base',
  '--z-overlay-low',
  '--z-overlay-med',
  '--z-overlay-high',
  '--z-overlay-video',
  '--z-overlay-settings',
  '--z-overlay-secondary',
  '--z-overlay-top',
  '--z-overlay-orbital',
];

/** Map cell-token variables to canonical design tokens from tokens.json.
 *  buildVariables() injects the resolved values so every token is SSOT.
 *  Frequency + status đều là absolute hex (1 set cho cả dark & light) —
 *  variant A "Tint vs Solid": pill tint nhạt + status capsule solid đậm đặc. */
const CELL_TOKEN_MAP: Record<string, string> = {
  // Status bar colors — absolute hex, theme-agnostic (1 set cho cả dark & light).
  // Painted as a capsule background on the in-flow .js-cell-token-status lane.
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
  // Bulk-selection wash — layered as background-image so the status capsule
  // and frequency pill survive underneath (Concept B "water wash").
  '--cell-token-selected': '--color-primary',
};

/** Sentence-highlight wash color. Resolved at build time to the default
 *  preset's dark-palette primary, then overwritten live by
 *  syncSentenceWashVar() from the ACTIVE theme config (customColors.dark.primary).
 *  The dark-palette variant is the luminance-lifted primary: measured on real
 *  pages it clears the visibility floor on BOTH dark backgrounds and stays a
 *  soft pastel on light ones, unlike the light-variant which nearly vanishes
 *  on dark. */
const SENTENCE_WASH_FALLBACK = DEFAULT_THEME_CONFIG.customColors.dark.primary;

function resolveMappedTokenValue(tokens: TokenRecord, designName: string): string {
  const value = tokens[designName] ?? '';
  return value.replace(/var\((--[\w-]+)\)/g, (reference, dependency: string) => tokens[dependency] ?? reference);
}

function buildVariables(rootSelector = ':root'): string {
  const lightDecls = [
    ...Object.entries(CELL_TOKEN_MAP).map(
      ([cellName, designName]) => `  ${cellName}: ${resolveMappedTokenValue(DEFAULT_LIGHT_TOKENS, designName)};`,
    ),
    `  ${SENTENCE_WASH_VAR}: ${SENTENCE_WASH_FALLBACK};`,
  ].join('\n');
  // Tokens sit on arbitrary host-page backgrounds — pin them to the light
  // palette so OS dark mode or a host [data-theme="dark"] ancestor can never
  // restyle them dark.
  const darkDecls = lightDecls;
  // Static tokens (spacing/radius/shadow/border-width/motion) are theme-
  // independent; inject once into :root so var() resolves on host pages where
  // tokens.css is never loaded. Without this, --border-width-status used by
  // the status capsule is an invalid declaration and silently dropped,
  // leaving the bar invisible while the frequency band (which only uses
  // --cell-token-* color vars) still shows.
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
}

/* Each word token is a self-sizing vertical unit: cap lane, word lane,
   status bar, gloss lane stacked in flow and spaced by 'gap' alone — no
   per-lane margins. The column width is the widest lane, so a long reading
   or gloss widens the whole unit and centers the shorter lanes instead of
   overlapping neighbouring tokens. The lanes always exist (content may be
   empty) and keep their line-height as reserved space, so asynchronously
   resolved metadata never reflows the line. Margin-block adds inter-row
   breathing so stacked annotation columns never touch the neighbouring
   line. Annotation-off tokens degrade to a single-item column, visually
   identical to the original inline word. */
html body .js-cell-token--word {
  display: inline-flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}

/* Lane spacing exists only while an annotation lane can render (reading cap
   or gloss footnote enabled); with both off the token must be flat inline
   text — no gap, no block margin inflating the host's line box. */
html body .js-cell-token--word:not(.js-cell-token--reading-off),
html body .js-cell-token--word:not(.js-cell-token--gloss-off) {
  gap: 0.14em !important;
  margin: 0.55em 0 !important;
}

/* The column's baseline is its first flex item (the cap lane). When the cap
   lane exists, lift the column by the cap-to-word baseline distance so the
   word lands back on the parent text baseline — word alignment stays exact
   relative to any inline ancestor (<a>, <sup>, separators), on both host
   pages and subtitle surfaces. 1.19em = cap lane (0.62em × 1.15) + lane gap
   (0.14em) + word ascent; calibrated on real layout to <0.2px error. */
html body .js-cell-token--word:not(.js-cell-token--reading-off) {
  vertical-align: 1.19em !important;
}

/* The inner span is the word lane of the token column. It stays transparent
   and square — painted visuals target either the column (frequency pill,
   selected wash parent) or the status span (capsule bar). line-height 1.1
   keeps the lane at the glyph cap height so the cap lane sits tight. */
.js-cell-token-word {
  display: inline !important;
  line-height: 1.1 !important;
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}

/* Ruby cap (spec reading-annotation): in-flow lane above the word, always
   generated so the reserved headroom exists before data-reading arrives.
   min-height is in the lane's own ems (0.62em font → ~0.71em of parent). The
   trailing zero-width space keeps a line box inside the lane when
   data-reading is absent — without it the empty item's baseline is
   synthesized from its bottom edge and the whole column rides ~3px high. */
html body .js-cell-token--word:not(.js-cell-token--reading-off)::before {
  content: attr(data-reading) '\\200B';
  min-height: 1.15em;
  font-size: 0.62em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: inherit;
  font-weight: inherit;
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
  font-size: 0.62em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: inherit;
  font-weight: inherit;
  color: inherit;
  opacity: 0.85;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
}

/* Status bar: the span sits between word lane and gloss lane in DOM order,
   rendered as a rounded capsule — column 'gap' provides the breathing room
   on both sides. Transparent until a status rule paints it; the lane itself
   stays reserved so toggling a status color never reflows. */
.js-cell-token-status {
  display: block !important;
  width: 100% !important;
  height: var(--border-width-status) !important;
  border-radius: 999px !important;
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  pointer-events: none !important;
  user-select: none !important;
}

/* Resolving: tokens are clickable word spans but status/frequency visuals are
   suppressed until metadata resolves, preventing the whole panel from flashing
   as colors pop in. */
html body .js-cell-token.js-cell-token--resolving {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  text-shadow: none !important;
  transition: none !important;
}
html body .js-cell-token.js-cell-token--resolving .js-cell-token-word {
  background-color: transparent !important;
  box-shadow: none !important;
}
html body .js-cell-token.js-cell-token--resolving .js-cell-token-status {
  background: transparent !important;
}

.js-cell-token--separator {
  display: inline !important;
  cursor: auto !important;
  background: transparent !important;
  color: inherit !important;
}

/* Frequency bands: contrasting fg on the token column (cap + gloss lanes
   inherit it) and the pill — background, hairline, radius and inner padding —
   painted on the column itself so the box wraps all three lanes. The word
   lane stays transparent inside the pill.
   Quadruple-specificity (html body .js-cell-token.js-cell-token--frequency-*)
   so host pages with high-specificity box-shadow:none!important rules (e.g.
   GeeksforGeeks Next.js resets at (0,2,1)) cannot override our !important.
   Band colors resolve from the injected --cell-token-* variables, which
   cascade from :root, prefers-color-scheme, or a [data-theme] ancestor. */
html body .js-cell-token.js-cell-token--frequency-core,
html body .js-cell-token.js-cell-token--frequency-common,
html body .js-cell-token.js-cell-token--frequency-general,
html body .js-cell-token.js-cell-token--frequency-advanced,
html body .js-cell-token.js-cell-token--frequency-rare {
  border-radius: var(--radius-md) !important;
  padding: 0.15em 0.3em !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-core {
  color: var(--cell-token-freq-core-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-core-fg) !important;
  background-color: var(--cell-token-freq-core-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-common {
  color: var(--cell-token-freq-common-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-common-fg) !important;
  background-color: var(--cell-token-freq-common-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-general {
  color: var(--cell-token-freq-general-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-general-fg) !important;
  background-color: var(--cell-token-freq-general-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-advanced {
  color: var(--cell-token-freq-advanced-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-advanced-fg) !important;
  background-color: var(--cell-token-freq-advanced-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-rare {
  color: var(--cell-token-freq-rare-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-rare-fg) !important;
  background-color: var(--cell-token-freq-rare-bg) !important;
}

/* Status capsule: single-color background on the status span between word
   and gloss — no halo, no ring, just the semantic fill. Quadruple-specificity
   (html body ancestor) so host box-shadow:none!important resets cannot
   override our !important. */
html body .js-cell-token.js-cell-token--status-unknown .js-cell-token-status {
  background: var(--cell-token-status-unknown) !important;
}
html body .js-cell-token.js-cell-token--status-tracking .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-tracking), var(--cell-token-status-unknown)) !important;
}
html body .js-cell-token.js-cell-token--status-known:hover:not(.js-cell-token--status-off) .js-cell-token-status,
html body .js-cell-token.js-cell-token--status-known.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-known) !important;
}
html body .js-cell-token.js-cell-token--status-ignore:hover:not(.js-cell-token--status-off) .js-cell-token-status,
html body .js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-ignore) !important;
}

/* Card layer: a term with ≥1 flashcard (Ocean SRS note or stored Anki link)
   appends the card color (--cell-token-status-learning) as the last gradient
   stop — card presence is orthogonal to the status, so every status gets the
   gradient suffix. The :not(--status-off) keeps
   the global status toggle winning despite the extra class raising
   specificity, and these rules stay before the i1-off gate so it can still
   hide the capsule at rest. */
html body .js-cell-token.js-cell-token--status-unknown.js-cell-token--has-card:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-unknown), var(--cell-token-status-learning)) !important;
}
html body .js-cell-token.js-cell-token--status-tracking.js-cell-token--has-card:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-tracking), var(--cell-token-status-unknown), var(--cell-token-status-learning)) !important;
}
html body .js-cell-token.js-cell-token--status-known.js-cell-token--has-card:hover:not(.js-cell-token--status-off) .js-cell-token-status,
html body .js-cell-token.js-cell-token--status-known.js-cell-token--has-card.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-known), var(--cell-token-status-learning)) !important;
}
html body .js-cell-token.js-cell-token--status-ignore.js-cell-token--has-card:hover:not(.js-cell-token--status-off) .js-cell-token-status,
html body .js-cell-token.js-cell-token--status-ignore.js-cell-token--has-card.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-ignore), var(--cell-token-status-learning)) !important;
}

.js-cell-token.js-cell-token--status-unknown,
.js-cell-token.js-cell-token--status-tracking,
.js-cell-token.js-cell-token--status-known:hover,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open,
.js-cell-token.js-cell-token--status-ignore:hover,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open {
  text-shadow: var(--shadow-sm) !important;
}

/* known/ignore render as plain text permanently — the frequency pill chrome
   (background, hairline, radius, padding) is fully removed so a learned word
   is indistinguishable from surrounding text. Hover or popup-open reveals
   only the status capsule, never the frequency background. status-off keeps
   the bar hidden even then; frequency-off keeps the pill hidden globally. */
html body .js-cell-token.js-cell-token--status-known,
html body .js-cell-token.js-cell-token--status-ignore {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}
html body .js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-status,
html body .js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-status {
  background: transparent !important;
}

/* i+1 gate: only the single still-new word of a sentence paints the frequency
   pill. Every other token carries --i1-off and renders as plain text — same
   reset as known/ignore, so a page full of unknown words stays readable
   instead of turning into a wall of pills. The status capsule is NOT gated:
   every unknown-family word (unknown + tracking flag) keeps its bar at rest so
   learners can always spot unlearned words. known/ignore stay hidden at rest
   via their own rules above and reveal on hover/popup-open. */
html body .js-cell-token.js-cell-token--i1-off {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

html body .js-cell-token.js-cell-token--selected .js-cell-token-word {
  background-image: linear-gradient(color-mix(in srgb, var(--cell-token-selected) 18%, transparent) 0 0) !important;
}

/* Sentence highlight: while a word is hovered (or its popup is open) the whole
   sentence is washed so the reading context is visible at a glance. The wash is
   painted by band overlays (sentenceHighlight.ts), not per-token backgrounds —
   one snapped rectangle per visual line keeps the edges straight. A plain alpha
   wash of the theme's dark-palette primary works on light AND dark host pages:
   multiply can only darken and vanishes on dark backgrounds. */
html body .js-cell-sentence-band {
  position: absolute !important;
  pointer-events: none !important;
  z-index: var(--z-overlay-base) !important;
  background: color-mix(in srgb, var(--cell-sentence-wash) 32%, transparent) !important;
}

/* Global layer toggles (applied per token).
   Quadruple-specificity (html body ancestor) so host box-shadow:none!important
   resets cannot override our !important. */
html body .js-cell-token.js-cell-token--status-off {
  text-shadow: var(--shadow-sm) !important;
}
html body .js-cell-token.js-cell-token--status-off .js-cell-token-status {
  background: transparent !important;
}
html body .js-cell-token.js-cell-token--frequency-off {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}
`.trim();
}

/** Re-resolve --cell-sentence-wash from the active theme config and write it to
 *  a tiny :root override in the host document head. Custom properties inherit
 *  through shadow boundaries, so the same var also reaches shadow-DOM token
 *  spans (subtitle panel, card creator, ...). */
function syncSentenceWashVar(): void {
  void loadThemeConfig()
    .then((config) => {
      const primary = config.customColors?.dark?.primary;
      if (!primary || typeof document === 'undefined') return;
      let el = document.getElementById(SENTENCE_WASH_STYLE_ID);
      if (!el) {
        el = document.createElement('style');
        el.id = SENTENCE_WASH_STYLE_ID;
        (document.head ?? document.documentElement).appendChild(el);
      }
      el.textContent = `:root { ${SENTENCE_WASH_VAR}: ${primary}; }`;
    })
    .catch(() => {});
}

/** Inject token-span style into the host document head (idempotent). */
export function injectTokenSpanStyle(): void {
  if (!document.getElementById(TOKEN_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = TOKEN_STYLE_ID;
    style.textContent = buildTokenSpanCss();
    (document.head ?? document.documentElement).appendChild(style);
  }
  if (!sentenceWashSyncStarted) {
    sentenceWashSyncStarted = true;
    syncSentenceWashVar();
    onStorageChanged((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEYS.THEME_CONFIG]) syncSentenceWashVar();
    });
  }
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
}

/* Self-sizing annotation column — same mechanism as the light-DOM builder:
   cap/word/status/gloss lanes stacked in flow, spaced by 'gap' alone; margin
   adds inter-row breathing so stacked columns never touch. */
.js-cell-token--word {
  display: inline-flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}

.js-cell-token--word:not(.js-cell-token--reading-off),
.js-cell-token--word:not(.js-cell-token--gloss-off) {
  gap: 0.14em !important;
  margin: 0.55em 0 !important;
}

/* Column baseline = cap lane baseline; lift by the cap-to-word distance so
   the word lands back on the parent text baseline (see light-DOM rule). */
.js-cell-token--word:not(.js-cell-token--reading-off) {
  vertical-align: 1.19em !important;
}

.js-cell-token-word {
  display: inline !important;
  line-height: 1.1 !important;
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}

/* Ruby cap (spec reading-annotation): in-flow lane above the word — never
   selectable, never copied. The trailing zero-width space keeps a line box
   inside the lane when data-reading is absent (see light-DOM rule). */
.js-cell-token--word:not(.js-cell-token--reading-off)::before {
  content: attr(data-reading) '\\200B';
  min-height: 1.15em;
  font-size: 0.62em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: inherit;
  font-weight: inherit;
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
  font-size: 0.62em;
  line-height: 1.15;
  white-space: nowrap;
  font-style: inherit;
  font-weight: inherit;
  color: inherit;
  opacity: 0.85;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
}

/* Status bar: real capsule lane between word and gloss — transparent until a
   status rule paints it (see light-DOM rule). */
.js-cell-token-status {
  display: block !important;
  width: 100% !important;
  height: var(--border-width-status) !important;
  border-radius: 999px !important;
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  pointer-events: none !important;
  user-select: none !important;
}

/* Resolving: suppress status/frequency visuals while metadata is loading. */
.js-cell-token.js-cell-token--resolving {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  text-shadow: none !important;
  transition: none !important;
}
.js-cell-token.js-cell-token--resolving .js-cell-token-word {
  background-color: transparent !important;
  box-shadow: none !important;
}
.js-cell-token.js-cell-token--resolving .js-cell-token-status {
  background: transparent !important;
}

.js-cell-token--separator {
  display: inline !important;
  cursor: auto !important;
  background: transparent !important;
  color: inherit !important;
}

.js-cell-token.js-cell-token--frequency-core,
.js-cell-token.js-cell-token--frequency-common,
.js-cell-token.js-cell-token--frequency-general,
.js-cell-token.js-cell-token--frequency-advanced,
.js-cell-token.js-cell-token--frequency-rare {
  border-radius: var(--radius-md) !important;
  padding: 0.15em 0.3em !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
.js-cell-token.js-cell-token--frequency-core {
  color: var(--cell-token-freq-core-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-core-fg) !important;
  background-color: var(--cell-token-freq-core-bg) !important;
}
.js-cell-token.js-cell-token--frequency-common {
  color: var(--cell-token-freq-common-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-common-fg) !important;
  background-color: var(--cell-token-freq-common-bg) !important;
}
.js-cell-token.js-cell-token--frequency-general {
  color: var(--cell-token-freq-general-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-general-fg) !important;
  background-color: var(--cell-token-freq-general-bg) !important;
}
.js-cell-token.js-cell-token--frequency-advanced {
  color: var(--cell-token-freq-advanced-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-advanced-fg) !important;
  background-color: var(--cell-token-freq-advanced-bg) !important;
}
.js-cell-token.js-cell-token--frequency-rare {
  color: var(--cell-token-freq-rare-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-rare-fg) !important;
  background-color: var(--cell-token-freq-rare-bg) !important;
}

.js-cell-token.js-cell-token--status-unknown .js-cell-token-status {
  background: var(--cell-token-status-unknown) !important;
}
.js-cell-token.js-cell-token--status-tracking .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-tracking), var(--cell-token-status-unknown)) !important;
}
.js-cell-token.js-cell-token--status-known:hover:not(.js-cell-token--status-off) .js-cell-token-status,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-known) !important;
}
.js-cell-token.js-cell-token--status-ignore:hover:not(.js-cell-token--status-off) .js-cell-token-status,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-ignore) !important;
}

/* Card layer — same gradient stops as the light-DOM builder (see above). */
.js-cell-token.js-cell-token--status-unknown.js-cell-token--has-card:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-unknown), var(--cell-token-status-learning)) !important;
}
.js-cell-token.js-cell-token--status-tracking.js-cell-token--has-card:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-tracking), var(--cell-token-status-unknown), var(--cell-token-status-learning)) !important;
}
.js-cell-token.js-cell-token--status-known.js-cell-token--has-card:hover:not(.js-cell-token--status-off) .js-cell-token-status,
.js-cell-token.js-cell-token--status-known.js-cell-token--has-card.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-known), var(--cell-token-status-learning)) !important;
}
.js-cell-token.js-cell-token--status-ignore.js-cell-token--has-card:hover:not(.js-cell-token--status-off) .js-cell-token-status,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--has-card.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: linear-gradient(90deg, var(--cell-token-status-ignore), var(--cell-token-status-learning)) !important;
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
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}
.js-cell-token.js-cell-token--status-known:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-status,
.js-cell-token.js-cell-token--status-ignore:not(:hover):not(.js-cell-token--popup-open) .js-cell-token-status {
  background: transparent !important;
}

.js-cell-token.js-cell-token--i1-off {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

.js-cell-token.js-cell-token--selected .js-cell-token-word {
  background-image: linear-gradient(color-mix(in srgb, var(--cell-token-selected) 18%, transparent) 0 0) !important;
}

.js-cell-sentence-band {
  position: absolute !important;
  pointer-events: none !important;
  z-index: var(--z-overlay-base) !important;
  background: color-mix(in srgb, var(--cell-sentence-wash) 32%, transparent) !important;
}

.js-cell-token.js-cell-token--status-off {
  text-shadow: var(--shadow-sm) !important;
}
.js-cell-token.js-cell-token--status-off .js-cell-token-status {
  background: transparent !important;
}
.js-cell-token.js-cell-token--frequency-off {
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}
`.trim();
}
