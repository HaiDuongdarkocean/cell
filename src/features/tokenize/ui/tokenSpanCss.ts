import { DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS, type TokenRecord } from '@/shared/lib/tokens';

const TOKEN_STYLE_ID = 'cell-token-span-style';

function pick(tokens: TokenRecord, name: string, fallback: string): string {
  return tokens[name] ?? fallback;
}

function buildVariables(): string {
  const light = DEFAULT_LIGHT_TOKENS;
  const dark = DEFAULT_DARK_TOKENS;
  const vars: Record<string, { light: string; dark: string }> = {
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
      light: pick(light, '--color-secondary', '#e2e8f0'),
      dark: pick(dark, '--color-secondary', '#334155'),
    },
    '--cell-token-freq-core-bg': {
      light: pick(light, '--color-success-subtle', 'rgba(5, 150, 105, 0.1)'),
      dark: pick(dark, '--color-success-subtle', 'rgba(16, 185, 129, 0.15)'),
    },
    '--cell-token-freq-core-fg': {
      light: pick(light, '--color-success', '#059669'),
      dark: pick(dark, '--color-success', '#10b981'),
    },
    '--cell-token-freq-common-bg': {
      light: pick(light, '--color-warning-subtle', 'rgba(217, 119, 6, 0.1)'),
      dark: pick(dark, '--color-warning-subtle', 'rgba(245, 158, 11, 0.15)'),
    },
    '--cell-token-freq-common-fg': {
      light: pick(light, '--color-warning', '#d97706'),
      dark: pick(dark, '--color-warning', '#f59e0b'),
    },
    '--cell-token-freq-general-bg': {
      light: pick(light, '--color-info-subtle', 'rgba(37, 99, 235, 0.1)'),
      dark: pick(dark, '--color-info-subtle', 'rgba(96, 165, 250, 0.15)'),
    },
    '--cell-token-freq-general-fg': {
      light: pick(light, '--color-info', '#2563eb'),
      dark: pick(dark, '--color-info', '#60a5fa'),
    },
    // ponytail: 'advanced' uses a surface token because the design system does
    // not currently expose a distinct semantic color for the 4th band. Tuning
    // this to a dedicated color (e.g. purple or teal) is a known upgrade path.
    '--cell-token-freq-advanced-bg': {
      light: pick(light, '--color-secondary', '#f8fafc'),
      dark: pick(dark, '--color-secondary', '#1e293b'),
    },
    '--cell-token-freq-advanced-fg': {
      light: pick(light, '--color-secondary-foreground', '#0f172a'),
      dark: pick(dark, '--color-secondary-foreground', '#f1f5f9'),
    },
    '--cell-token-freq-rare-bg': {
      light: pick(light, '--color-muted', 'rgba(100, 116, 139, 0.1)'),
      dark: pick(dark, '--color-muted', 'rgba(148, 163, 184, 0.15)'),
    },
    '--cell-token-freq-rare-fg': {
      light: pick(light, '--color-muted-foreground', '#64748b'),
      dark: pick(dark, '--color-muted-foreground', '#94a3b8'),
    },
  };

  const lines: string[] = [':root {'];
  for (const [name, values] of Object.entries(vars)) {
    lines.push(`  ${name}: ${values.light};`);
  }
  lines.push('}');
  lines.push('@media (prefers-color-scheme: dark) {');
  lines.push('  :root {');
  for (const [name, values] of Object.entries(vars)) {
    lines.push(`    ${name}: ${values.dark};`);
  }
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}

export function buildTokenSpanCss(): string {
  return `
${buildVariables()}

.js-cell-token {
  display: inline-block !important;
  vertical-align: baseline !important;
  line-height: inherit !important;
  position: relative !important;
  white-space: normal !important;
  overflow-wrap: break-word !important;
  cursor: pointer !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  color: inherit !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  text-decoration: none !important;
}

.js-cell-token--word {
  /* word-level wrapper; children inherit alignment */
}

.js-cell-token-word {
  display: inline !important;
  background: transparent !important;
  color: inherit !important;
}

.js-cell-token-status {
  position: absolute !important;
  top: 82% !important;
  left: 0 !important;
  right: 0 !important;
  height: 0.2px !important;
  border-radius: 1px !important;
  pointer-events: none !important;
  display: block !important;
  margin-top: 1px !important;
}

.js-cell-token--separator {
  display: inline !important;
  cursor: auto !important;
  background: transparent !important;
  color: inherit !important;
}

.js-cell-token--status-unknown .js-cell-token-status { background-color: var(--cell-token-status-unknown) !important; }
.js-cell-token--status-tracking .js-cell-token-status { background-color: var(--cell-token-status-tracking) !important; }
.js-cell-token--status-known .js-cell-token-status { background-color: var(--cell-token-status-known) !important; }
.js-cell-token--status-ignore .js-cell-token-status { background-color: var(--cell-token-status-ignore) !important; }

.js-cell-token--frequency-core { background-color: var(--cell-token-freq-core-bg) !important; color: var(--cell-token-freq-core-fg) !important; }
.js-cell-token--frequency-common { background-color: var(--cell-token-freq-common-bg) !important; color: var(--cell-token-freq-common-fg) !important; }
.js-cell-token--frequency-general { background-color: var(--cell-token-freq-general-bg) !important; color: var(--cell-token-freq-general-fg) !important; }
.js-cell-token--frequency-advanced { background-color: var(--cell-token-freq-advanced-bg) !important; color: var(--cell-token-freq-advanced-fg) !important; }
.js-cell-token--frequency-rare { background-color: var(--cell-token-freq-rare-bg) !important; color: var(--cell-token-freq-rare-fg) !important; }

/* known/ignore hide status + frequency by default; hover reveals status when status layer is on */
.js-cell-token--status-known .js-cell-token-status,
.js-cell-token--status-ignore .js-cell-token-status {
  display: none !important;
}
.js-cell-token--status-known:hover .js-cell-token-status,
.js-cell-token--status-ignore:hover .js-cell-token-status {
  display: block !important;
}

.js-cell-token--status-known,
.js-cell-token--status-ignore {
  background-color: transparent !important;
  color: inherit !important;
}

.js-cell-token--status-ignore {
  opacity: 0.5 !important;
}
.js-cell-token--status-ignore .js-cell-token-word {
  text-decoration: line-through !important;
}

/* Global layer toggles (applied per token) */
.js-cell-token--status-off .js-cell-token-status {
  display: none !important;
}
.js-cell-token--frequency-off {
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
