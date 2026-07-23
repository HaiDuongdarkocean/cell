import { DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS, type TokenRecord } from '@/shared/lib/tokens';

const TOKEN_STYLE_ID = 'cell-token-span-style';

function pick(tokens: TokenRecord, name: string, fallback: string): string {
  return tokens[name] ?? fallback;
}

function buildVariables(): string {
  const light = DEFAULT_LIGHT_TOKENS;
  const dark = DEFAULT_DARK_TOKENS;
  const vars: Record<string, { light: string; dark: string }> = {
    // Status bar colors (semantic DS colors). The bar is rendered as an inset
    // box-shadow on the token so it survives multi-line inline fragments.
    '--cell-token-status-unknown': {
      light: pick(light, '--color-error', '#dc2626'),
      dark: pick(dark, '--color-error', '#ef4444'),
    },
    '--cell-token-status-tracking': {
      light: pick(light, '--color-warning', '#d97706'),
      dark: pick(dark, '--color-warning', '#f59e0b'),
    },
    '--cell-token-status-known': {
      light: pick(light, '--color-success', '#059669'),
      dark: pick(dark, '--color-success', '#10b981'),
    },
    '--cell-token-status-ignore': {
      light: pick(light, '--color-text-muted', '#64748b'),
      dark: pick(dark, '--color-text-muted', '#94a3b8'),
    },
    // Soft Tonal frequency bands: dedicated tokens in tokens.json.
    // Light mode uses muted pastel backgrounds with dark text.
    // Dark mode uses a single slate container (#374151) with soft pastel text
    // to reduce eye strain and avoid the saturated M3 dark container colors.
    '--cell-token-freq-core-bg': {
      light: pick(light, '--color-token-freq-core-bg', '#e2f3e7'),
      dark: pick(dark, '--color-token-freq-core-bg', '#374151'),
    },
    '--cell-token-freq-core-fg': {
      light: pick(light, '--color-token-freq-core-fg', '#14532d'),
      dark: pick(dark, '--color-token-freq-core-fg', '#bbf7d0'),
    },
    '--cell-token-freq-common-bg': {
      light: pick(light, '--color-token-freq-common-bg', '#e5effd'),
      dark: pick(dark, '--color-token-freq-common-bg', '#374151'),
    },
    '--cell-token-freq-common-fg': {
      light: pick(light, '--color-token-freq-common-fg', '#1e3a8a'),
      dark: pick(dark, '--color-token-freq-common-fg', '#bfdbfe'),
    },
    '--cell-token-freq-general-bg': {
      light: pick(light, '--color-token-freq-general-bg', '#fdf9e6'),
      dark: pick(dark, '--color-token-freq-general-bg', '#374151'),
    },
    '--cell-token-freq-general-fg': {
      light: pick(light, '--color-token-freq-general-fg', '#713f12'),
      dark: pick(dark, '--color-token-freq-general-fg', '#fef08a'),
    },
    '--cell-token-freq-advanced-bg': {
      light: pick(light, '--color-token-freq-advanced-bg', '#fff3e8'),
      dark: pick(dark, '--color-token-freq-advanced-bg', '#374151'),
    },
    '--cell-token-freq-advanced-fg': {
      light: pick(light, '--color-token-freq-advanced-fg', '#7c2d12'),
      dark: pick(dark, '--color-token-freq-advanced-fg', '#fed7aa'),
    },
    '--cell-token-freq-rare-bg': {
      light: pick(light, '--color-token-freq-rare-bg', '#f3f4f6'),
      dark: pick(dark, '--color-token-freq-rare-bg', '#374151'),
    },
    '--cell-token-freq-rare-fg': {
      light: pick(light, '--color-token-freq-rare-fg', '#1f2937'),
      dark: pick(dark, '--color-token-freq-rare-fg', '#f3f4f6'),
    },
  };

  const lightDecls = Object.entries(vars).map(([name, values]) => `  ${name}: ${values.light};`).join('\n');
  const darkDecls = Object.entries(vars).map(([name, values]) => `  ${name}: ${values.dark};`).join('\n');

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
  border-radius: 0.15em !important;
  outline: none !important;
  box-shadow: none !important;
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
   Variables are defined ON the token class itself (not just :root) so they
   always resolve even if the host breaks the :root cascade. */
.js-cell-token.js-cell-token--frequency-core {
  --cell-token-freq-core-bg: #e2f3e7;
  --cell-token-freq-core-fg: #14532d;
  background-color: var(--cell-token-freq-core-bg) !important;
  color: var(--cell-token-freq-core-fg) !important;
}
.js-cell-token.js-cell-token--frequency-common {
  --cell-token-freq-common-bg: #e5effd;
  --cell-token-freq-common-fg: #1e3a8a;
  background-color: var(--cell-token-freq-common-bg) !important;
  color: var(--cell-token-freq-common-fg) !important;
}
.js-cell-token.js-cell-token--frequency-general {
  --cell-token-freq-general-bg: #fdf9e6;
  --cell-token-freq-general-fg: #713f12;
  background-color: var(--cell-token-freq-general-bg) !important;
  color: var(--cell-token-freq-general-fg) !important;
}
.js-cell-token.js-cell-token--frequency-advanced {
  --cell-token-freq-advanced-bg: #fff3e8;
  --cell-token-freq-advanced-fg: #7c2d12;
  background-color: var(--cell-token-freq-advanced-bg) !important;
  color: var(--cell-token-freq-advanced-fg) !important;
}
.js-cell-token.js-cell-token--frequency-rare {
  --cell-token-freq-rare-bg: #f3f4f6;
  --cell-token-freq-rare-fg: #1f2937;
  background-color: var(--cell-token-freq-rare-bg) !important;
  color: var(--cell-token-freq-rare-fg) !important;
}
@media (prefers-color-scheme: dark) {
  .js-cell-token.js-cell-token--frequency-core {
    --cell-token-freq-core-bg: #374151;
    --cell-token-freq-core-fg: #bbf7d0;
  }
  .js-cell-token.js-cell-token--frequency-common {
    --cell-token-freq-common-bg: #374151;
    --cell-token-freq-common-fg: #bfdbfe;
  }
  .js-cell-token.js-cell-token--frequency-general {
    --cell-token-freq-general-bg: #374151;
    --cell-token-freq-general-fg: #fef08a;
  }
  .js-cell-token.js-cell-token--frequency-advanced {
    --cell-token-freq-advanced-bg: #374151;
    --cell-token-freq-advanced-fg: #fed7aa;
  }
  .js-cell-token.js-cell-token--frequency-rare {
    --cell-token-freq-rare-bg: #374151;
    --cell-token-freq-rare-fg: #f3f4f6;
  }
}

/* Status bar: 2px inset underline in the semantic color plus a 2px white
   highlight at the same offset. The highlight lightens the underline when the
   status color matches the pill background (e.g. known on a core green token).
   Double-class specificity so host box-shadow rules don't override. */
.js-cell-token.js-cell-token--status-unknown {
  box-shadow:
    inset 0 -2px 0 0 var(--cell-token-status-unknown),
    inset 0 -2px 0 0 rgba(255, 255, 255, 0.45) !important;
}
.js-cell-token.js-cell-token--status-tracking {
  box-shadow:
    inset 0 -2px 0 0 var(--cell-token-status-tracking),
    inset 0 -2px 0 0 rgba(255, 255, 255, 0.45) !important;
}
.js-cell-token.js-cell-token--status-known {
  box-shadow:
    inset 0 -2px 0 0 var(--cell-token-status-known),
    inset 0 -2px 0 0 rgba(255, 255, 255, 0.45) !important;
}
.js-cell-token.js-cell-token--status-ignore {
  box-shadow:
    inset 0 -2px 0 0 var(--cell-token-status-ignore),
    inset 0 -2px 0 0 rgba(255, 255, 255, 0.45) !important;
}

/* Text guard removed: the 2px inset status underline no longer needs a halo
   to keep the glyph legible. */
.js-cell-token.js-cell-token--status-unknown,
.js-cell-token.js-cell-token--status-tracking,
.js-cell-token.js-cell-token--status-known:hover,
.js-cell-token.js-cell-token--status-known.js-cell-token--popup-open,
.js-cell-token.js-cell-token--status-ignore:hover,
.js-cell-token.js-cell-token--status-ignore.js-cell-token--popup-open {
  text-shadow: none !important;
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
  box-shadow: none !important;
  text-shadow: none !important;
}

/* Ignore is rendered the same as known: no frequency, no status by default,
   status appears on hover. No extra de-emphasis styling is applied. */

/* Global layer toggles (applied per token) */
.js-cell-token.js-cell-token--status-off {
  box-shadow: none !important;
  text-shadow: none !important;
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

/** Remove injected token-span style. */
export function removeTokenSpanStyle(): void {
  document.getElementById(TOKEN_STYLE_ID)?.remove();
}
