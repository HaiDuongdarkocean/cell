import type { ReactElement, CSSProperties } from 'react';

interface Swatch {
  token: string;
  /** Optional text rendered on top of the swatch for contrast check */
  on?: string;
}

const swatchStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--font-size-2xs)',
  fontFamily: 'var(--font-family-code)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-family-code)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-secondary)',
  minWidth: 200,
};

const groupTitleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 'var(--font-size-sm)',
  marginBottom: 4,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 8,
};

function SwatchRow({ s }: { s: Swatch }): ReactElement {
  const bg: CSSProperties = { ...swatchStyle, background: `var(${s.token})` };
  return (
    <div style={rowStyle}>
      <div style={bg}>
        {s.on ? <span style={{ color: `var(${s.on})` }}>Aa</span> : null}
      </div>
      <span style={labelStyle}>{s.token}</span>
    </div>
  );
}

function Group({ title, items }: { title: string; items: readonly Swatch[] }): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={groupTitleStyle}>{title}</span>
      <div style={gridStyle}>
        {items.map((s) => (
          <SwatchRow key={s.token} s={s} />
        ))}
      </div>
    </div>
  );
}

/* === Core (9) === */
const CORE: readonly Swatch[] = [
  { token: '--color-primary' },
  { token: '--color-background' },
  { token: '--color-surface' },
  { token: '--color-text', on: '--color-background' },
  { token: '--color-text-secondary' },
  { token: '--color-border' },
  { token: '--color-success' },
  { token: '--color-warning' },
  { token: '--color-error' },
];

/* === Semantic — Primary/Secondary/Accent === */
const SEMANTIC_PALETTE: readonly Swatch[] = [
  { token: '--color-primary-hover' },
  { token: '--color-primary-active' },
  { token: '--color-primary-subtle' },
  { token: '--color-primary-foreground', on: '--color-primary' },
  { token: '--color-primary-foreground-soft', on: '--color-primary' },
  { token: '--color-secondary' },
  { token: '--color-secondary-hover' },
  { token: '--color-secondary-foreground', on: '--color-secondary' },
  { token: '--color-accent' },
  { token: '--color-accent-foreground', on: '--color-accent' },
  { token: '--color-accent-muted' },
  { token: '--color-on-accent', on: '--color-accent' },
  { token: '--color-muted' },
  { token: '--color-muted-foreground', on: '--color-muted' },
  { token: '--color-background-muted' },
  { token: '--color-destructive' },
  { token: '--color-destructive-hover' },
  { token: '--color-destructive-foreground', on: '--color-destructive' },
];

/* === Semantic — Text/Icon/Border === */
const SEMANTIC_TEXT: readonly Swatch[] = [
  { token: '--color-text-primary', on: '--color-background' },
  { token: '--color-text-disabled' },
  { token: '--color-text-accent' },
  { token: '--color-text-inverse', on: '--color-text' },
  { token: '--color-on-dark', on: '--color-background-inverted' },
  { token: '--color-on-light', on: '--color-surface' },
  { token: '--color-icon-primary', on: '--color-background' },
  { token: '--color-icon-secondary' },
  { token: '--color-icon-disabled' },
  { token: '--color-icon-accent' },
  { token: '--color-border-emphasized' },
  { token: '--color-border-subtle' },
  { token: '--color-border-focus' },
  { token: '--color-input' },
  { token: '--color-ring' },
];

/* === Semantic — Surface/Overlay/Status === */
const SEMANTIC_SURFACE: readonly Swatch[] = [
  { token: '--color-surface-card' },
  { token: '--color-surface-popover' },
  { token: '--color-surface-hover' },
  { token: '--color-card-foreground', on: '--color-surface-card' },
  { token: '--color-popover-foreground', on: '--color-surface-popover' },
  { token: '--color-background-inverted' },
  { token: '--color-background-error-inverted' },
  { token: '--color-overlay' },
  { token: '--color-overlay-hover' },
  { token: '--color-overlay-pressed' },
  { token: '--color-overlay-text', on: '--color-overlay' },
  { token: '--color-overlay-background' },
  { token: '--color-neutral' },
  { token: '--color-skeleton' },
  { token: '--color-track' },
  { token: '--color-shadow' },
  { token: '--color-tint-hover' },
  { token: '--color-fill-foreground-white' },
];

/* === Status === */
const STATUS: readonly Swatch[] = [
  { token: '--color-success-subtle' },
  { token: '--color-success-muted' },
  { token: '--color-on-success', on: '--color-success' },
  { token: '--color-warning-subtle' },
  { token: '--color-warning-muted' },
  { token: '--color-on-warning', on: '--color-warning' },
  { token: '--color-error-subtle' },
  { token: '--color-error-muted' },
  { token: '--color-on-error', on: '--color-error' },
  { token: '--color-info' },
  { token: '--color-info-subtle' },
];

/* === Scrollbar === */
const SCROLLBAR: readonly Swatch[] = [
  { token: '--color-scrollbar-thumb' },
  { token: '--color-scrollbar-thumb-hover' },
  { token: '--color-scrollbar-track' },
];

/* === Frequency tokens === */
const FREQ: readonly Swatch[] = [
  { token: '--color-token-freq-core-bg', on: '--color-token-freq-core-fg' },
  { token: '--color-token-freq-common-bg', on: '--color-token-freq-common-fg' },
  { token: '--color-token-freq-general-bg', on: '--color-token-freq-general-fg' },
  { token: '--color-token-freq-advanced-bg', on: '--color-token-freq-advanced-fg' },
  { token: '--color-token-freq-rare-bg', on: '--color-token-freq-rare-fg' },
  { token: '--color-token-freq-border' },
];

/* === Tint (10 colors × 4 variants = 40) === */
const TINT_COLORS = ['blue', 'cyan', 'gray', 'green', 'orange', 'pink', 'purple', 'red', 'teal', 'yellow'] as const;
const TINT_VARIANTS = ['background', 'border', 'icon', 'text'] as const;
const TINT: readonly Swatch[] = TINT_COLORS.flatMap((color) =>
  TINT_VARIANTS.map((variant) => ({ token: `--color-tint-${color}-${variant}` })),
);

/* === Data Visualization (11) === */
const DATA: readonly Swatch[] = [
  { token: '--color-data-categorical-blue' },
  { token: '--color-data-categorical-orange' },
  { token: '--color-data-categorical-purple' },
  { token: '--color-data-categorical-green' },
  { token: '--color-data-categorical-pink' },
  { token: '--color-data-categorical-cyan' },
  { token: '--color-data-categorical-red' },
  { token: '--color-data-categorical-teal' },
  { token: '--color-data-categorical-brown' },
  { token: '--color-data-categorical-indigo' },
  { token: '--color-data-neutral' },
];

/* === Syntax (14) === */
const SYNTAX: readonly Swatch[] = [
  { token: '--color-syntax-keyword' },
  { token: '--color-syntax-string' },
  { token: '--color-syntax-comment' },
  { token: '--color-syntax-number' },
  { token: '--color-syntax-function' },
  { token: '--color-syntax-type' },
  { token: '--color-syntax-variable' },
  { token: '--color-syntax-operator' },
  { token: '--color-syntax-constant' },
  { token: '--color-syntax-tag' },
  { token: '--color-syntax-attribute' },
  { token: '--color-syntax-property' },
  { token: '--color-syntax-punctuation' },
  { token: '--color-syntax-background' },
];

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Group title="Core (9)" items={CORE} />
      <Group title="Semantic — Palette" items={SEMANTIC_PALETTE} />
      <Group title="Semantic — Text / Icon / Border" items={SEMANTIC_TEXT} />
      <Group title="Semantic — Surface / Overlay / Misc" items={SEMANTIC_SURFACE} />
      <Group title="Status" items={STATUS} />
      <Group title="Scrollbar" items={SCROLLBAR} />
      <Group title="Frequency" items={FREQ} />
      <Group title="Tint (10 colors × 4 variants = 40)" items={TINT} />
      <Group title="Data Visualization (11)" items={DATA} />
      <Group title="Syntax (14)" items={SYNTAX} />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Color Scale',
  description: 'All --color-* tokens: Core (9), Semantic (~50), Tint (40), Data viz (11), Syntax (14). Swatches with Aa show foreground-on-background contrast.',
  group: 'Tokens',
  order: 2,
};
