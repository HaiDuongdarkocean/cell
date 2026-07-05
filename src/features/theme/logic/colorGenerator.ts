// colorGenerator — pure color utilities (ADR-022 D2).
//
// Content-script-safe: no DOM deps (no document/window). Used by cả
// themeManager (popup/options/sidepanel :root) + themeTokens.ts (content-script
// container inject). Derive secondary tokens from 9 core — DRY, no drift.

/** Regex for 6-digit hex (#RRGGBB) or 3-digit (#RGB). Case-insensitive. */
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse hex string → {r,g,b} (0-255). Throws on invalid hex. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = HEX_RE.exec(hex.trim());
  if (!match) throw new Error(`Invalid hex color: "${hex}"`);
  let h = match[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Convert {r,g,b} → #rrggbb (lowercase). */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/**
 * Relative luminance per WCAG 2.1 (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
 * Returns 0 (black) → 1 (white).
 */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Shade (darken) a hex color by `percent` (0-100).
 * 0% = unchanged, 100% = black. Negative = lighten (tint).
 */
export function generateShade(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = (100 - percent) / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

/**
 * Tint (lighten) a hex color by `percent` (0-100).
 * 0% = unchanged, 100% = white.
 */
export function generateTint(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * (percent / 100),
    g + (255 - g) * (percent / 100),
    b + (255 - b) * (percent / 100),
  );
}

/** Hover color = shade 10% (darker). Used for --color-primary-hover, --color-surface-hover. */
export function generateHoverColor(hex: string): string {
  return generateShade(hex, 10);
}

/**
 * Generate a 50-950 palette (Tailwind-style) from a base hex.
 * Returns 9 stops: 50 (lightest) → 950 (darkest). Base hex placed at 500.
 * ponytail: simple linear interpolation between white/base/black. V2 could use
 * OKLCH for perceptually-uniform ramps.
 */
export function generatePalette(hex: string): Record<string, string> {
  const stops: Record<string, string> = {};
  const lightStops = [50, 100, 200, 300, 400];
  const darkStops = [600, 700, 800, 900, 950];
  for (const s of lightStops) {
    const pct = (500 - s) / 5 * 90; // 50→90% tint, 400→18% tint
    stops[s] = generateTint(hex, pct);
  }
  stops[500] = hex;
  for (const s of darkStops) {
    const pct = (s - 500) / 9 * 90; // 600→10% shade, 950→~44% shade
    stops[s] = generateShade(hex, pct);
  }
  return stops;
}
