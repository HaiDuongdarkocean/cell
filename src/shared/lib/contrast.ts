// contrast.ts — Canonical WCAG 2.1 color contrast engine.
//
// Pure (no DOM). Used by:
//   - runtime: src/shared/lib/tokens.ts (via src/features/theme/logic/contrastValidator.ts)
//   - build:   scripts/generate-tokens.js (via jiti)
//
// Supports literal hex, rgb, rgba, color-mix(in srgb, ...), named colors,
// and CSS var(--color-*) resolution against a token map. Translucent colors
// are alpha-composited over a caller-supplied opaque backdrop.

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorInput = string | Rgba;

export interface ContrastRating {
  readonly level: 'AAA' | 'AA' | 'Fail';
  readonly ratio: number;
  readonly pass: boolean;
}

export class UnsupportedColorError extends Error {
  constructor(value: string, reason = 'Unsupported color format') {
    super(`${reason}: "${value}"`);
    this.name = 'UnsupportedColorError';
  }
}

export class MissingTokenError extends Error {
  constructor(token: string) {
    super(`Missing token: --${token}`);
    this.name = 'MissingTokenError';
  }
}

export class ColorCycleError extends Error {
  constructor(token: string) {
    super(`Color token cycle detected: --${token}`);
    this.name = 'ColorCycleError';
  }
}

export class ContrastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContrastError';
  }
}

const NAMED_COLORS: Record<string, string> = {
  transparent: 'rgba(0,0,0,0)',
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function roundAlpha(n: number): number {
  return Math.round(clamp01(n) * 10000) / 10000;
}

function normalizeInput(input: ColorInput): string {
  if (typeof input !== 'string') {
    return toRgbaString(input);
  }
  const trimmed = input.trim().toLowerCase();
  return NAMED_COLORS[trimmed] ?? trimmed;
}

function toRgbaString(color: Rgba): string {
  return `rgba(${clampByte(color.r)},${clampByte(color.g)},${clampByte(color.b)},${clamp01(color.a)})`;
}

function hexToRgba(value: string): Rgba {
  const hex = value.replace('#', '').trim();
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(hex)) {
    throw new UnsupportedColorError(value);
  }
  let full = hex;
  if (hex.length === 3) {
    full = hex.split('').map((c) => c + c).join('');
  }
  if (full.length === 8) {
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: roundAlpha(parseInt(full.slice(6, 8), 16) / 255),
    };
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 1,
  };
}

function parseComponent(s: string): number {
  const v = s.trim();
  if (v.endsWith('%')) {
    const pct = parseFloat(v);
    if (Number.isNaN(pct)) throw new UnsupportedColorError(v);
    return clampByte((pct / 100) * 255);
  }
  const n = parseFloat(v);
  if (Number.isNaN(n)) throw new UnsupportedColorError(v);
  return clampByte(n);
}

function rgbToRgba(value: string): Rgba {
  const m = value.match(/^rgba?\(\s*([^)]+)\)$/i);
  if (!m) throw new UnsupportedColorError(value);
  const parts = m[1].split(',').map((s) => s.trim());
  if (parts.length < 3) throw new UnsupportedColorError(value);
  const a = parts.length === 4 ? clamp01(parseFloat(parts[3])) : 1;
  return {
    r: parseComponent(parts[0]),
    g: parseComponent(parts[1]),
    b: parseComponent(parts[2]),
    a,
  };
}

function splitTopLevelArgs(s: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  args.push(current.trim());
  return args;
}

function parseColorMixArg(arg: string): { color: string; percent?: number } {
  const m = arg.match(/^(.+?)\s+(\d+(?:\.\d+)?)%$/);
  if (m) return { color: m[1].trim(), percent: parseFloat(m[2]) / 100 };
  return { color: arg };
}

function colorMixToRgba(value: string): Rgba {
  const innerMatch = value.match(/^color-mix\s*\(\s*(.+?)\s*\)$/is);
  if (!innerMatch) throw new UnsupportedColorError(value);
  const args = splitTopLevelArgs(innerMatch[1]);
  if (args.length < 3 || args[0].trim().toLowerCase() !== 'in srgb') {
    throw new UnsupportedColorError(value);
  }
  const arg1 = parseColorMixArg(args[1]);
  const arg2 = parseColorMixArg(args[2]);

  const c1 = parseColor(arg1.color);
  const c2 = parseColor(arg2.color);

  const p1 = arg1.percent ?? (arg2.percent === undefined ? 0.5 : 1 - arg2.percent);
  const p2 = arg2.percent ?? (arg1.percent === undefined ? 0.5 : 1 - arg1.percent);

  const a = c1.a * p1 + c2.a * p2;
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  const r = (c1.r * c1.a * p1 + c2.r * c2.a * p2) / a;
  const g = (c1.g * c1.a * p1 + c2.g * c2.a * p2) / a;
  const b = (c1.b * c1.a * p1 + c2.b * c2.a * p2) / a;
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: roundAlpha(a) };
}

/** Parse a 3/6-digit hex string → {r,g,b}. Legacy alias kept for API compat. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  const isHex = /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(clean);
  if (!isHex) throw new UnsupportedColorError(`Invalid hex color: "${hex}"`);
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Convert {r,g,b} → lowercase #rrggbb. Legacy alias kept for API compat. */
export function rgbToHex(r: number, g: number, b: number): string {
  return toHex({ r, g, b, a: 1 });
}

/** Parse a literal CSS color (no var() resolution). Throws on unsupported format. */
export function parseColor(input: ColorInput): Rgba {
  if (typeof input !== 'string') {
    return { r: clampByte(input.r), g: clampByte(input.g), b: clampByte(input.b), a: clamp01(input.a) };
  }
  const value = normalizeInput(input);
  if (value.startsWith('#') || /^[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(value)) {
    return hexToRgba(value);
  }
  if (value.startsWith('rgba(') || value.startsWith('rgb(')) return rgbToRgba(value);
  if (value.startsWith('color-mix(')) return colorMixToRgba(value);
  throw new UnsupportedColorError(input);
}

/** Resolve a CSS color token string against a token map, expanding var() chains. */
export function resolveColor(
  value: string,
  tokenMap: Record<string, string>,
  seen: Set<string> = new Set(),
): Rgba {
  const raw = value.trim();
  if (!raw) throw new UnsupportedColorError(raw);

  try {
    return parseColor(raw);
  } catch {
    // fall through to var() expansion
  }

  let expanded = raw;
  let changed = true;
  while (changed) {
    changed = false;
    expanded = expanded.replace(/var\(--([a-zA-Z0-9-]+)\)/g, (_, token) => {
      if (seen.has(token)) throw new ColorCycleError(token);
      const next = tokenMap[token];
      if (next === undefined) throw new MissingTokenError(token);
      seen.add(token);
      changed = true;
      return next;
    });
  }

  return parseColor(expanded);
}

/** Alpha-composite foreground over background. Both must be Rgba. */
export function composite(foreground: Rgba, background: Rgba): Rgba {
  const a = foreground.a + background.a * (1 - foreground.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const r = (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / a;
  const g = (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / a;
  const b = (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / a;
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: roundAlpha(a) };
}

/** Relative luminance per WCAG 2.1. Requires an opaque color. */
export function getLuminance(input: ColorInput): number {
  const color = parseColor(input);
  if (color.a < 1) {
    throw new ContrastError(
      'getLuminance requires an opaque color; use getContrastRatio with a backdrop for translucent colors',
    );
  }
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function effectiveOpaque(fg: Rgba, bg: Rgba, backdrop?: ColorInput): Rgba {
  let effectiveBg = bg;
  if (bg.a < 1) {
    if (backdrop === undefined) {
      throw new ContrastError('Translucent background requires a backdrop color');
    }
    effectiveBg = composite(bg, parseColor(backdrop));
  }
  if (fg.a < 1 || effectiveBg.a < 1) {
    return composite(fg, effectiveBg);
  }
  return fg;
}

/** WCAG contrast ratio between two colors. Translucent colors are flattened against the supplied backdrop. */
export function getContrastRatio(fg: ColorInput, bg: ColorInput, backdrop?: ColorInput): number {
  const fgColor = parseColor(fg);
  const bgColor = parseColor(bg);
  const effectiveFg = effectiveOpaque(fgColor, bgColor, backdrop);
  const effectiveBg = bgColor.a < 1 ? composite(bgColor, parseColor(backdrop ?? '#ffffff')) : bgColor;
  const l1 = getLuminance(effectiveFg);
  const l2 = getLuminance(effectiveBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAA(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
}

export function meetsAAA(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 4.5 : ratio >= 7.0;
}

export function meetsAALarge(ratio: number): boolean {
  return meetsAA(ratio, true);
}

export function getRating(ratio: number, isLargeText = false): ContrastRating {
  if (meetsAAA(ratio, isLargeText)) return { level: 'AAA', ratio, pass: true };
  if (meetsAA(ratio, isLargeText)) return { level: 'AA', ratio, pass: true };
  return { level: 'Fail', ratio, pass: false };
}

/** Convert {r,g,b,a} to lowercase #rrggbb (alpha is dropped). */
export function toHex(input: ColorInput): string {
  const color = parseColor(input);
  const c = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${c(color.r)}${c(color.g)}${c(color.b)}`;
}

/** Pick the first foreground candidate that meets WCAG AA against background. */
export function pickPrimaryForeground(
  background: ColorInput,
  candidates: readonly (string | Rgba)[] = ['#000000', '#ffffff'],
): string {
  const bg = parseColor(background);
  for (const candidate of candidates) {
    if (meetsAA(getContrastRatio(candidate, bg))) {
      return toHex(candidate);
    }
  }
  return toHex(candidates[candidates.length - 1]);
}
