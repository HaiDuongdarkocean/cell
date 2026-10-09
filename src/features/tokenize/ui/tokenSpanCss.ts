import { DEFAULT_LIGHT_TOKENS, STATIC_TOKENS, type TokenRecord } from '@/shared/lib/tokens';

const TOKEN_STYLE_ID = 'cell-token-span-style';

/** Static design tokens that token-span CSS references via var() but that are
 *  NOT loaded on host pages (tokens.css only ships in popup/sidepanel/showcase).
 *  We inject the resolved values here so var() resolves on the host page.
 *  Static tokens are theme-independent, so a single :root block suffices. */
const STATIC_TOKENS_NEEDED: readonly string[] = [
  '--space-0-5',
  '--space-1',
  '--space-1-5',
  '--space-2',
  '--shadow-sm',
  '--border-width-hairline',
  '--border-width-status',
  '--radius-md',
  '--duration-100',
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

function resolveMappedTokenValue(tokens: TokenRecord, designName: string): string {
  const value = tokens[designName] ?? '';
  return value.replace(/var\((--[\w-]+)\)/g, (reference, dependency: string) => tokens[dependency] ?? reference);
}

function buildVariables(rootSelector = ':root'): string {
  const lightDecls = Object.entries(CELL_TOKEN_MAP)
    .map(([cellName, designName]) => `  ${cellName}: ${resolveMappedTokenValue(DEFAULT_LIGHT_TOKENS, designName)};`)
    .join('\n');
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

/* Tokens render as native CSS ruby: the token is a ruby container with
   ruby-position:under so its ::after (the gloss) becomes a ruby-text lane
   below the base. Ruby reserves annotation width natively — the base box
   grows to max(word, annotation) and centers it — so neighbouring glosses
   can never overlap and the base never splits across lines. position:relative
   still anchors the out-of-flow status bar inside the word lane;
   --cell-token-annotation-scale sizes the ruby-text off the token's ems. */
.js-cell-token {
  display: ruby !important;
  ruby-position: under !important;
  position: relative !important;
  vertical-align: baseline !important;
  --cell-token-annotation-scale: 0.62;
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

/* Word tokens are ruby containers too (re-asserted at html body specificity
   so host inline-block/inline-flex resets can't break the annotation lanes).
   Ancestor semantics (<a> underline/color/hover, <sup>) still propagate into
   the base text — and text-decoration never reaches ruby-text lanes, so IPA
   and gloss stay un-underlined inside links while the word keeps the native
   underline. Annotation-off tokens render identical to the original text. */
html body .js-cell-token--word {
  display: ruby !important;
  padding: 0 !important;
  border: 0 !important;
}

/* The nested ruby element carries the IPA: its own ::after ruby-text sits
   above the word lane (ruby-position:over) while the token's ::after gloss
   sits below (ruby-position:under on the token). Its base is the word lane. */
html body .js-cell-token-ruby {
  display: ruby !important;
  ruby-position: over !important;
}

/* The inner span is the word lane — the ruby base both annotations measure
   against. It stays transparent and square; painted visuals target either
   the lane (frequency pill, selected wash) or the status span (capsule bar).
   position:relative anchors the status bar; line-height inherits the host's
   so an unannotated token never alters the line pitch — annotation room is
   created by padding on the ruby-text boxes, which grows the line pitch only
   for annotated tokens. */
.js-cell-token-word {
  display: inline !important;
  position: relative !important;
  line-height: inherit !important;
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}

/* IPA cap (spec reading-annotation): ruby-text lane above the word, centered
   by the ruby container. Ruby-text never receives propagated text-decoration,
   so the cap is never underlined inside <a>. Vertical padding is part of the
   ruby annotation box — it increases the line pitch only where caps exist. */
html body .js-cell-token--word:not(.js-cell-token--reading-off) > .js-cell-token-ruby::after {
  content: attr(data-reading);
  display: ruby-text;
  font-size: calc(var(--cell-token-annotation-scale) * 1em);
  line-height: 1.15;
  white-space: nowrap;
  font-style: inherit;
  font-weight: inherit;
  color: inherit;
  opacity: 0.92;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
  padding: var(--space-1) .35em var(--space-0-5);
}

/* Gloss footnote (spec word-translation): ruby-text lane below the base
   (the token's ruby-position:under). Never selectable, never copied, never
   underlined. Bottom padding clears the status bar that hangs off the lane. */
html body .js-cell-token--word:not(.js-cell-token--gloss-off)::after {
  content: attr(data-gloss);
  display: ruby-text;
  font-size: calc(var(--cell-token-annotation-scale) * 1em);
  line-height: 1.15;
  white-space: nowrap;
  font-style: inherit;
  font-weight: inherit;
  color: inherit;
  opacity: 0.85;
  text-shadow: var(--shadow-sm);
  pointer-events: none;
  user-select: none;
  padding: var(--space-1-5) .35em var(--space-2);
}

/* Status bar: out-of-flow capsule pinned just under the word lane. Its
   left/right track the pill padding vars so the bar spans exactly the word
   width whether the token wears a frequency pill or not. Transparent until
   a status rule paints it. */
.js-cell-token-status {
  display: block !important;
  position: absolute !important;
  top: calc(100% + var(--space-0-5)) !important;
  left: var(--cell-token-pill-pad-x, 0px) !important;
  right: var(--cell-token-pill-pad-x, 0px) !important;
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

/* Frequency bands: contrasting fg on the token (the ruby-text annotations
   inherit it) while the pill chrome — background, hairline, radius and inner
   padding — paints the word lane, so the pill hugs the word inside the
   annotation-width base instead of stretching under a wider gloss. Pill
   padding is exposed via --cell-token-pill-pad-x/y on the lane so the status
   bar inside it can offset against it; strip rules zero them on both.
   Quadruple-specificity (html body .js-cell-token.js-cell-token--frequency-*)
   so host pages with high-specificity box-shadow:none!important rules (e.g.
   GeeksforGeeks Next.js resets at (0,2,1)) cannot override our !important.
   Band colors resolve from the injected --cell-token-* variables, which
   cascade from :root, prefers-color-scheme, or a [data-theme] ancestor. */
html body .js-cell-token.js-cell-token--frequency-core > .js-cell-token-ruby > .js-cell-token-word,
html body .js-cell-token.js-cell-token--frequency-common > .js-cell-token-ruby > .js-cell-token-word,
html body .js-cell-token.js-cell-token--frequency-general > .js-cell-token-ruby > .js-cell-token-word,
html body .js-cell-token.js-cell-token--frequency-advanced > .js-cell-token-ruby > .js-cell-token-word,
html body .js-cell-token.js-cell-token--frequency-rare > .js-cell-token-ruby > .js-cell-token-word {
  --cell-token-pill-pad-x: 0.3em;
  --cell-token-pill-pad-y: 0.15;
  padding: calc(var(--cell-token-pill-pad-y) * 1em) var(--cell-token-pill-pad-x) !important;
  border-radius: var(--radius-md) !important;
  box-shadow: inset 0 0 0 var(--border-width-hairline) var(--cell-token-freq-border) !important;
}
html body .js-cell-token.js-cell-token--frequency-core {
  color: var(--cell-token-freq-core-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-core-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-core > .js-cell-token-ruby > .js-cell-token-word {
  background-color: var(--cell-token-freq-core-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-common {
  color: var(--cell-token-freq-common-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-common-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-common > .js-cell-token-ruby > .js-cell-token-word {
  background-color: var(--cell-token-freq-common-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-general {
  color: var(--cell-token-freq-general-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-general-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-general > .js-cell-token-ruby > .js-cell-token-word {
  background-color: var(--cell-token-freq-general-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-advanced {
  color: var(--cell-token-freq-advanced-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-advanced-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-advanced > .js-cell-token-ruby > .js-cell-token-word {
  background-color: var(--cell-token-freq-advanced-bg) !important;
}
html body .js-cell-token.js-cell-token--frequency-rare {
  color: var(--cell-token-freq-rare-fg) !important;
  -webkit-text-fill-color: var(--cell-token-freq-rare-fg) !important;
}
html body .js-cell-token.js-cell-token--frequency-rare > .js-cell-token-ruby > .js-cell-token-word {
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
  background: var(--cell-token-status-tracking) !important;
}
html body .js-cell-token.js-cell-token--status-learning .js-cell-token-status {
  background: var(--cell-token-status-learning) !important;
}
html body .js-cell-token.js-cell-token--status-known:hover:not(.js-cell-token--status-off) .js-cell-token-status,
html body .js-cell-token.js-cell-token--status-known.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-known) !important;
}
html body .js-cell-token.js-cell-token--status-ignore:hover:not(.js-cell-token--status-off) .js-cell-token-status,
html body .js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-ignore) !important;
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

/* known/ignore render as plain text permanently — the frequency pill chrome
   (background, hairline, radius, padding) is fully removed so a learned word
   is indistinguishable from surrounding text. Hover or popup-open reveals
   only the status capsule, never the frequency background. status-off keeps
   the bar hidden even then; frequency-off keeps the pill hidden globally. */
html body .js-cell-token.js-cell-token--status-known,
html body .js-cell-token.js-cell-token--status-ignore,
html body .js-cell-token.js-cell-token--status-known > .js-cell-token-ruby > .js-cell-token-word,
html body .js-cell-token.js-cell-token--status-ignore > .js-cell-token-ruby > .js-cell-token-word {
  --cell-token-pill-pad-x: 0px;
  --cell-token-pill-pad-y: 0;
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
   pill. Every other still-new token carries --i1-off, which strips the pill
   chrome only — the status capsule stays visible for all still-new tokens. */
html body .js-cell-token.js-cell-token--i1-off,
html body .js-cell-token.js-cell-token--i1-off > .js-cell-token-ruby > .js-cell-token-word {
  --cell-token-pill-pad-x: 0px;
  --cell-token-pill-pad-y: 0;
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
   sentence is washed so the reading context is visible at a glance. The wash
   paints the word lane and the gap spans — never the annotation lanes — so it
   tracks the text line like a highlighter. On the lane it layers as
   background-image so a frequency pill underneath still shows through, the
   same way --selected does. */
html body .js-cell-token.js-cell-token--sentence .js-cell-token-word {
  background-image: linear-gradient(color-mix(in srgb, var(--cell-token-selected) 22%, transparent) 0 0) !important;
}
html body .js-cell-token--separator.js-cell-token--sentence {
  background-color: color-mix(in srgb, var(--cell-token-selected) 22%, transparent) !important;
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
html body .js-cell-token.js-cell-token--frequency-off,
html body .js-cell-token.js-cell-token--frequency-off > .js-cell-token-ruby > .js-cell-token-word {
  --cell-token-pill-pad-x: 0px;
  --cell-token-pill-pad-y: 0;
  color: inherit !important;
  -webkit-text-fill-color: currentColor !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
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
}

/* Self-sizing annotation column — same mechanism as the light-DOM builder:
   cap/word/status/gloss lanes stacked in flow, tight against each other with
   no gap and no margin (the column must not inflate the host's line pitch). */
.js-cell-token--word {
  display: inline-flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding: 0 !important;
  border: 0 !important;
}

/* Column baseline = cap lane baseline; lift by the cap-to-word distance so
   the word lands back on the parent text baseline. 1.05em is calibrated for
   cap font-size 0.62em + word lane line-height 1.1; re-measure if either
   changes (see light-DOM rule). */
.js-cell-token--word:not(.js-cell-token--reading-off) {
  vertical-align: 1.05em !important;
}

/* The ruby wrapper only exists for the host-page ruby layout — inside the
   shadow column it must disappear so ::before cap, word lane and ::after
   gloss stay direct flex items of the token. */
.js-cell-token-ruby {
  display: contents !important;
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
  background: var(--cell-token-status-tracking) !important;
}
.js-cell-token.js-cell-token--status-learning .js-cell-token-status {
  background: var(--cell-token-status-learning) !important;
}
.js-cell-token.js-cell-token--status-known:hover:not(.js-cell-token--status-off) .js-cell-token-status,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-known) !important;
}
.js-cell-token.js-cell-token--status-ignore:hover:not(.js-cell-token--status-off) .js-cell-token-status,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open:not(.js-cell-token--status-off) .js-cell-token-status {
  background: var(--cell-token-status-ignore) !important;
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

/* i+1 gate: --i1-off strips the frequency pill chrome only; the status
   capsule stays visible for all still-new tokens (see light-DOM rule). */
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

.js-cell-token.js-cell-token--sentence .js-cell-token-word,
.js-cell-token--separator.js-cell-token--sentence {
  background-color: color-mix(in srgb, var(--cell-token-selected) 22%, transparent) !important;
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
