// Design-token runtime helpers (SSOT: src/shared/styles/tokens.json).
//
// Provides default palettes, static/component token formatting, and a shared
// deriveColorTokens() used by themeManager (popup/options/sidepanel) and
// themeTokens.ts (content script). tokens.css is generated from the same JSON
// source via scripts/generate-tokens.js.

import tokensJson from '../styles/tokens.json';
import {
  generateHoverColor,
  generateShade,
  generateTint,
} from '@/shared/lib/colorGenerator';
import { hexToRgb } from '@/shared/lib/contrast';
import { pickPrimaryForeground } from '@/shared/lib/contrastValidator';
import type { CoreColorTokens, PresetName, ResolvedMode } from '@/entities/theme/types';

/** Map of CSS custom-property name (incl. leading --) to value. */
export type TokenRecord = Readonly<Record<string, string>>;

const CORE_KEYS: (keyof CoreColorTokens)[] = [
  'primary',
  'background',
  'surface',
  'text',
  'textSecondary',
  'border',
  'success',
  'warning',
  'error',
];

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

const tryHexToRgb = (value: string): { r: number; g: number; b: number } | null => {
  const match = HEX_RE.exec(value.trim());
  if (!match) return null;
  let h = match[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const mapCoreColors = (colors: CoreColorTokens): TokenRecord => {
  const out: Record<string, string> = {};
  for (const key of CORE_KEYS) {
    const name = kebab(key);
    out[`--color-${name}`] = colors[key];
    const { r, g, b } = hexToRgb(colors[key]);
    out[`--color-${name}-rgb`] = `${r}, ${g}, ${b}`;
  }
  return out;
};

const rgbaVar = (key: keyof CoreColorTokens, alpha: number): string =>
  `rgba(var(--color-${kebab(key)}-rgb), ${alpha})`;

const isEqualCore = (a: CoreColorTokens, b: CoreColorTokens): boolean =>
  CORE_KEYS.every((k) => a[k] === b[k]);

type PresetData = {
  readonly core: { readonly light: CoreColorTokens; readonly dark: CoreColorTokens };
  readonly derived: { readonly light: Record<string, string>; readonly dark: Record<string, string> };
};

const PRESET_DATA = tokensJson.presets as Record<PresetName, PresetData>;

/** Get the core palette for a named preset. */
export const getPresetColors = (
  preset: PresetName,
): { readonly light: CoreColorTokens; readonly dark: CoreColorTokens } => PRESET_DATA[preset].core;

const prefixDerived = (derived: Record<string, string>): TokenRecord => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(derived)) {
    out[`--${key}`] = value;
  }
  return out;
};

/** Composite typography tokens expanded into individual CSS properties. */
const flattenCompositeTokens = (): TokenRecord => {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokensJson.composite)) {
    out[`--${name}-font-size`] = value.fontSize;
    out[`--${name}-font-weight`] = value.fontWeight;
    out[`--${name}-line-height`] = value.lineHeight;
    out[`--${name}-letter-spacing`] = value.letterSpacing;
  }
  return out;
};

/** Default light core palette (from tokens.json). */
export const DEFAULT_LIGHT_COLORS: CoreColorTokens = { ...tokensJson.core.light };

/** Default dark core palette (from tokens.json). */
export const DEFAULT_DARK_COLORS: CoreColorTokens = { ...tokensJson.core.dark };

/** Breakpoint pixel values for JS matchMedia / innerWidth checks.
 *  CSS @media must hardcode the same values (CSS custom properties don't work
 *  in media queries).
 *  Market breakpoints:
 *    Compact    < 600px
 *    Medium     600px – 839px
 *    Expanded   840px – 1199px
 *    Large      1200px – 1599px
 *    ExtraLarge ≥ 1600px
 *  Use in JS matchMedia / innerWidth checks. CSS @media must hardcode
 *  the same values (CSS custom properties don't work in @media queries). */
export const BREAKPOINTS = {
  compact: 0,
  medium: 600,
  expanded: 840,
  large: 1200,
  extraLarge: 1600,
} as const;

/** Complete default light token map (core + derived + composite). */
export const DEFAULT_LIGHT_TOKENS: TokenRecord = {
  ...mapCoreColors(DEFAULT_LIGHT_COLORS),
  ...prefixDerived(tokensJson.derived.light),
  ...flattenCompositeTokens(),
};

/** Complete default dark token map (core + derived + composite). */
export const DEFAULT_DARK_TOKENS: TokenRecord = {
  ...mapCoreColors(DEFAULT_DARK_COLORS),
  ...prefixDerived(tokensJson.derived.dark),
  ...flattenCompositeTokens(),
};

/** Derive the full color token map from 9 core tokens, a mode, and an optional preset. */
export function deriveColorTokens(
  colors: CoreColorTokens,
  mode: ResolvedMode,
  preset?: PresetName,
): TokenRecord {
  const surfaceHover = generateHoverColor(colors.surface);
  const secondary = colors.surface;
  const primaryForeground = pickPrimaryForeground(colors);

  // Tokens that must be computed from the runtime palette; base derived fills
  // the rest; optional preset derived overrides for hand-tuned glass/hover.
  const computedTokens: TokenRecord = {
    '--color-primary-hover': generateHoverColor(colors.primary),
    '--color-primary-active': generateShade(colors.primary, 20),
    '--color-primary-subtle': rgbaVar('primary', mode === 'dark' ? 0.12 : 0.1),
    '--color-primary-foreground': primaryForeground,
    '--color-text-on-primary': primaryForeground,
    '--color-secondary': secondary,
    '--color-secondary-hover': generateHoverColor(secondary),
    '--color-secondary-foreground': colors.text,
    '--color-accent': surfaceHover,
    '--color-accent-foreground': colors.text,
    '--color-muted': surfaceHover,
    '--color-destructive': colors.error,
    '--color-destructive-hover': generateHoverColor(colors.error),
    '--color-destructive-foreground': colors.background,
    '--color-text-inverse': colors.background,
    '--color-border-subtle': generateShade(colors.surface, 5),
    '--color-border-focus': colors.primary,
    '--color-input': colors.border,
    '--color-ring': colors.primary,
    '--color-surface-hover': surfaceHover,
    '--color-success-subtle': rgbaVar('success', mode === 'dark' ? 0.15 : 0.1),
    '--color-warning-subtle': rgbaVar('warning', mode === 'dark' ? 0.15 : 0.1),
    '--color-error-subtle': rgbaVar('error', mode === 'dark' ? 0.15 : 0.1),
    '--color-success-muted': mode === 'dark' ? generateShade(colors.success, 80) : generateTint(colors.success, 90),
    '--color-warning-muted': mode === 'dark' ? generateShade(colors.warning, 80) : generateTint(colors.warning, 95),
    '--color-error-muted': mode === 'dark' ? generateShade(colors.error, 80) : generateTint(colors.error, 96),
    '--color-info': colors.primary,
    '--color-info-subtle': rgbaVar('primary', 0.1),
  };

  const presetDerived = preset ? prefixDerived(PRESET_DATA[preset].derived[mode]) : {};

  return {
    ...mapCoreColors(colors),
    ...prefixDerived(tokensJson.derived[mode]),
    ...computedTokens,
    ...presetDerived,
    ...flattenCompositeTokens(),
  };
}

/** Get the full color token map, using precomputed defaults when they match. */
export function getColorTokens(
  colors: CoreColorTokens,
  mode: ResolvedMode,
  preset?: PresetName,
): TokenRecord {
  const baseColors = preset ? { ...PRESET_DATA[preset].core[mode], ...colors } : colors;
  if (!preset) {
    const defaultColors = mode === 'dark' ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS;
    if (isEqualCore(colors, defaultColors)) {
      return mode === 'dark' ? DEFAULT_DARK_TOKENS : DEFAULT_LIGHT_TOKENS;
    }
  }
  return deriveColorTokens(baseColors, mode, preset);
}

/** Format a color token block as indented CSS declarations for injection. */
export function buildColorTokenCSS(
  colors: CoreColorTokens,
  mode: ResolvedMode,
  preset?: PresetName,
  indent = '  ',
): string {
  const tokens = getColorTokens(colors, mode, preset);
  const lines: string[] = [`${indent}color-scheme: ${mode};`];
  for (const [name, value] of Object.entries(tokens)) {
    lines.push(`${indent}${name}: ${value};`);
  }
  return lines.join('\n');
}

const flattenStaticTokens = (): TokenRecord => {
  const out: Record<string, string> = {};
  const { static: s } = tokensJson;

  out['--font-family'] = s.font.family;
  out['--font-family-sans'] = s.font.family;
  out['--font-family-body'] = s.font.family;
  out['--font-family-heading'] = s.font.headingFamily;
  out['--font-family-code'] = s.font.codeFamily;
  out['--font-family-mono'] = s.font.monoFamily;
  for (const [k, v] of Object.entries(s.font.sizes)) out[`--font-size-${k}`] = v;
  for (const [k, v] of Object.entries(s.font.weights)) out[`--font-weight-${k}`] = String(v);
  for (const [k, v] of Object.entries(s.font.leading)) out[`--leading-${k}`] = String(v);
  for (const [k, v] of Object.entries(s.font.tracking)) out[`--tracking-${k}`] = v;

  for (const [k, v] of Object.entries(s.spacing)) out[`--space-${k}`] = v;
  for (const [k, v] of Object.entries(s.size)) out[`--size-${k}`] = String(v);
  for (const [k, v] of Object.entries(s.radius)) out[`--radius-${k}`] = v;
  for (const [k, v] of Object.entries(s.shadow)) out[`--shadow-${k}`] = v;
  for (const [k, v] of Object.entries(s.borderWidth)) out[`--border-width-${k}`] = v;
  for (const [k, v] of Object.entries(s.strokeWidth)) out[`--stroke-width-${k}`] = v;
  for (const [k, v] of Object.entries(s.blur)) out[`--blur-${k}`] = v;
  for (const [k, v] of Object.entries(s.opacity ?? {})) out[`--opacity-${k}`] = String(v);
  for (const [k, v] of Object.entries(s.motion)) out[`--${k}`] = v;
  for (const [k, v] of Object.entries(s.zIndex)) out[`--z-${k}`] = String(v);
  for (const [k, v] of Object.entries(s.navCluster)) {
    out[`--nav-cluster-${k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`] = String(v);
  }
  for (const [k, v] of Object.entries(s.overlay)) {
    const name = `--overlay-${k}`;
    out[name] = String(v);
    const rgb = typeof v === 'string' ? tryHexToRgb(v) : null;
    if (rgb) {
      out[`${name}-rgb`] = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    }
  }
  for (const [k, v] of Object.entries(s.touchTarget)) out[`--touch-target-${k}`] = String(v);
  for (const [k, v] of Object.entries(s.popupImage)) out[`--popup-image-${k}`] = String(v);

  Object.assign(out, flattenCompositeTokens());

  return out;
};

const flattenComponentTokens = (): TokenRecord => {
  const out: Record<string, string> = {};
  for (const [component, tokens] of Object.entries(tokensJson.component)) {
    for (const [k, v] of Object.entries(tokens)) {
      const name = `--${component}-${k}`;
      out[name] = v;
      const rgb = tryHexToRgb(v);
      if (rgb) {
        out[`${name}-rgb`] = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
      }
    }
  }
  return out;
};

/** Static (non-color) design tokens (spacing, radius, shadow, border-width,
 *  motion, z-index, overlay, touch-target, composite). Used by content-script
 *  CSS injectors (e.g. tokenSpanCss) that run on host pages where tokens.css
 *  is never loaded — they need the resolved values, not the var() refs. */
export const STATIC_TOKENS: TokenRecord = flattenStaticTokens();

const COMPONENT_TOKENS = flattenComponentTokens();

/** Indented CSS declarations for all static (non-color) tokens. */
export function formatStaticTokens(): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(STATIC_TOKENS)) {
    lines.push(`  ${name}: ${value};`);
  }
  return lines.join('\n');
}

/** Indented CSS declarations for all component tokens. */
export function formatComponentTokens(): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(COMPONENT_TOKENS)) {
    lines.push(`  ${name}: ${value};`);
  }
  return lines.join('\n');
}
