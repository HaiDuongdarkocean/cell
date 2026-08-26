import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CORE_COLOR_KEYS = [
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

function kebabCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  const isHex = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(clean);
  if (!isHex) return null;
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

function flattenStaticTokens(staticObj) {
  const lines = [];
  const push = (name, value) => {
    if (typeof value === 'number') {
      lines.push(`  --${name}: ${value};`);
    } else {
      lines.push(`  --${name}: ${value};`);
    }
    const rgb = typeof value === 'string' ? hexToRgb(value) : null;
    if (rgb) {
      lines.push(`  --${name}-rgb: ${rgb.r}, ${rgb.g}, ${rgb.b};`);
    }
  };

  // font
  push('font-family', staticObj.font.family);
  push('font-family-body', staticObj.font.family);
  push('font-family-heading', staticObj.font.headingFamily);
  push('font-family-code', staticObj.font.codeFamily);
  push('font-family-mono', staticObj.font.monoFamily);
  for (const [key, value] of Object.entries(staticObj.font.sizes)) {
    push(`font-size-${key}`, value);
  }
  for (const [key, value] of Object.entries(staticObj.font.weights)) {
    push(`font-weight-${key}`, value);
  }
  for (const [key, value] of Object.entries(staticObj.font.leading)) {
    push(`leading-${key}`, value);
  }
  for (const [key, value] of Object.entries(staticObj.font.tracking)) {
    push(`tracking-${key}`, value);
  }

  // spacing — SSOT: chỉ generate --space-*, không alias --spacing-* (trùng lặp)
  for (const [key, value] of Object.entries(staticObj.spacing)) {
    push(`space-${key}`, value);
  }

  // size
  if (staticObj.size) {
    for (const [key, value] of Object.entries(staticObj.size)) {
      push(`size-${key}`, value);
    }
  }

  // avatar
  if (staticObj.avatar) {
    for (const [key, value] of Object.entries(staticObj.avatar)) {
      push(`avatar-${key}`, value);
    }
  }

  // radius
  for (const [key, value] of Object.entries(staticObj.radius)) {
    push(`radius-${key}`, value);
  }

  // shadow
  for (const [key, value] of Object.entries(staticObj.shadow)) {
    push(`shadow-${key}`, value);
  }

  // borderWidth
  for (const [key, value] of Object.entries(staticObj.borderWidth)) {
    push(`border-width-${key}`, value);
  }

  // strokeWidth
  for (const [key, value] of Object.entries(staticObj.strokeWidth)) {
    push(`stroke-width-${key}`, value);
  }

  // blur
  for (const [key, value] of Object.entries(staticObj.blur)) {
    push(`blur-${key}`, value);
  }

  // motion
  for (const [key, value] of Object.entries(staticObj.motion)) {
    push(key, value);
  }

  // zIndex
  for (const [key, value] of Object.entries(staticObj.zIndex)) {
    push(`z-${key}`, value);
  }

  // navCluster
  for (const [key, value] of Object.entries(staticObj.navCluster)) {
    push(`nav-cluster-${key}`, value);
  }

  // touchTarget
  for (const [key, value] of Object.entries(staticObj.touchTarget)) {
    push(`touch-target-${key}`, value);
  }

  // popupImage
  for (const [key, value] of Object.entries(staticObj.popupImage)) {
    push(`popup-image-${key}`, value);
  }

  // overlay
  for (const [key, value] of Object.entries(staticObj.overlay)) {
    push(`overlay-${key}`, value);
  }

  return lines.join('\n');
}

function flattenComponentTokens(componentObj) {
  const lines = [];
  for (const [component, tokens] of Object.entries(componentObj)) {
    for (const [key, value] of Object.entries(tokens)) {
      lines.push(`  --${component}-${key}: ${value};`);
      const rgb = typeof value === 'string' ? hexToRgb(value) : null;
      if (rgb) {
        lines.push(`  --${component}-${key}-rgb: ${rgb.r}, ${rgb.g}, ${rgb.b};`);
      }
    }
  }
  return lines.join('\n');
}

function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(a, b) {
  const l1 = getLuminance(a);
  const l2 = getLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickPrimaryForeground(core) {
  const candidates = [core.background, core.text, '#000000', '#FFFFFF'];
  for (const candidate of candidates) {
    const ratio = getContrastRatio(candidate, core.primary);
    if (ratio >= 4.5) return candidate;
  }
  return '#FFFFFF';
}

function resolveColorToken(value, core, derived, seen = new Set()) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('#')) return value;

  const varMatch = value.match(/^var\(--color-([^)]+)\)$/);
  if (varMatch) {
    const token = varMatch[1];
    if (seen.has(token)) return null; // cycle guard
    seen.add(token);

    if (derived[`color-${token}`] !== undefined) {
      return resolveColorToken(derived[`color-${token}`], core, derived, seen);
    }

    const coreKey = token.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (core[coreKey]) return core[coreKey];
  }

  return null;
}

function validateContrastPairs(mode, core, derived) {
  // Secondary/muted text pairs use 3:1 (WCAG AA for large text ≥18pt),
  // per Astryx/Meta standard (daft.md) which uses #737373 for text-secondary.
  const LARGE_TEXT_THRESHOLD = 3.0;
  const NORMAL_TEXT_THRESHOLD = 4.5;
  const largeTextPairs = new Set([
    'Text Secondary / Background',
    'Text Muted / Background',
    'Text Muted / Surface',
    'Muted Foreground / Muted',
  ]);
  const pairs = [
    ['Text / Background', core.text, core.background],
    ['Text / Surface', core.text, core.surface],
    ['Text Secondary / Background', core.textSecondary, core.background],
    ['Text Muted / Background', derived['color-text-muted'], core.background],
    ['Text Muted / Surface', derived['color-text-muted'], core.surface],
    ['Primary Foreground / Primary', derived['color-primary-foreground'], core.primary],
    ['Text on Primary / Primary', derived['color-text-on-primary'], core.primary],
    ['Primary Soft Foreground / Primary', derived['color-primary-foreground-soft'], core.primary],
    ['Secondary Foreground / Secondary', derived['color-secondary-foreground'], derived['color-secondary']],
    ['Accent Foreground / Accent', derived['color-accent-foreground'], derived['color-accent']],
    ['Card Foreground / Card', derived['color-card-foreground'], derived['color-card']],
    ['Popover Foreground / Popover', derived['color-popover-foreground'], derived['color-popover']],
    ['Muted Foreground / Muted', derived['color-muted-foreground'], derived['color-muted']],
    ['Destructive Foreground / Destructive', derived['color-destructive-foreground'], derived['color-destructive']],
    ['Inverse Text / Warning', derived['color-text-inverse'], core.warning],
    ['Inverse Text / Success', derived['color-text-inverse'], core.success],
    ['Inverse Text / Error', derived['color-text-inverse'], core.error],
    ['Frequency Core / Core BG', derived['color-token-freq-core-fg'], derived['color-token-freq-core-bg']],
    ['Frequency Common / Common BG', derived['color-token-freq-common-fg'], derived['color-token-freq-common-bg']],
    ['Frequency General / General BG', derived['color-token-freq-general-fg'], derived['color-token-freq-general-bg']],
    ['Frequency Advanced / Advanced BG', derived['color-token-freq-advanced-fg'], derived['color-token-freq-advanced-bg']],
    ['Frequency Rare / Rare BG', derived['color-token-freq-rare-fg'], derived['color-token-freq-rare-bg']],
  ];
  const failures = [];
  for (const [label, rawFg, rawBg] of pairs) {
    const fg = resolveColorToken(rawFg, core, derived);
    const bg = resolveColorToken(rawBg, core, derived);
    if (!fg || !bg || !fg.startsWith('#') || !bg.startsWith('#')) continue;
    const ratio = getContrastRatio(fg, bg);
    const threshold = largeTextPairs.has(label) ? LARGE_TEXT_THRESHOLD : NORMAL_TEXT_THRESHOLD;
    if (ratio < threshold) failures.push(`${mode} ${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
  }
  return failures;
}

function buildColorBlock(core, derived, mode) {
  const lines = [`  color-scheme: ${mode};`];
  for (const key of CORE_COLOR_KEYS) {
    const name = kebabCase(key);
    lines.push(`  --color-${name}: ${core[key]};`);
    const rgb = hexToRgb(core[key]);
    if (rgb) {
      lines.push(`  --color-${name}-rgb: ${rgb.r}, ${rgb.g}, ${rgb.b};`);
    }
  }
  for (const [key, value] of Object.entries(derived)) {
    lines.push(`  --${key}: ${value};`);
  }
  return lines.join('\n');
}

function flattenCompositeTokens(composite) {
  const lines = [];
  for (const [name, value] of Object.entries(composite)) {
    lines.push(`  --${name}-font-size: ${value.fontSize};`);
    lines.push(`  --${name}-font-weight: ${value.fontWeight};`);
    lines.push(`  --${name}-line-height: ${value.lineHeight};`);
    lines.push(`  --${name}-letter-spacing: ${value.letterSpacing};`);
  }
  return lines.join('\n');
}

async function main() {
  const tokensPath = join(__dirname, '..', 'src', 'shared', 'styles', 'tokens.json');
  const cssPath = join(__dirname, '..', 'src', 'shared', 'styles', 'tokens.css');

  const tokens = JSON.parse(await readFile(tokensPath, 'utf8'));

  // Compute accessible primary-foreground text color at build time so the
  // generated tokens.css always ships a WCAG AA --color-text-on-primary.
  for (const mode of ['light', 'dark']) {
    tokens.derived[mode]['color-text-on-primary'] = pickPrimaryForeground(tokens.core[mode]);
  }

  const staticBlock = flattenStaticTokens(tokens.static);
  const compositeBlock = flattenCompositeTokens(tokens.composite);
  const componentBlock = flattenComponentTokens(tokens.component);
  const lightColorBlock = buildColorBlock(tokens.core.light, tokens.derived.light, 'light');
  const darkColorBlock = buildColorBlock(tokens.core.dark, tokens.derived.dark, 'dark');

  const contrastFailures = [
    ...validateContrastPairs('light', tokens.core.light, tokens.derived.light),
    ...validateContrastPairs('dark', tokens.core.dark, tokens.derived.dark),
  ];

  // Per-preset blocks: merge default core/derived with the preset override.
  const presetBlocks = [];
  const presets = tokens.presets || {};
  for (const [name, preset] of Object.entries(presets)) {
    for (const mode of ['light', 'dark']) {
      const mergedCore = { ...tokens.core[mode], ...preset.core[mode] };
      const mergedDerived = { ...tokens.derived[mode], ...preset.derived[mode] };
      // Ensure the computed --color-text-on-primary matches the merged palette.
      mergedDerived['color-text-on-primary'] = pickPrimaryForeground(mergedCore);
      const colorBlock = buildColorBlock(mergedCore, mergedDerived, mode);
      contrastFailures.push(...validateContrastPairs(mode, mergedCore, mergedDerived));
      presetBlocks.push(`[data-preset="${name}"][data-theme="${mode}"] {\n${colorBlock}\n${componentBlock}\n}`);
    }
  }

  if (contrastFailures.length) {
    throw new Error(`WCAG AA contrast failures:\n${contrastFailures.join('\n')}`);
  }

  // Static tokens live on :root / :host. Color + component tokens live inside
  // a [data-theme] or [data-preset][data-theme] boundary because component
  // tokens reference color vars, and CSS custom properties resolve at the
  // element where they are DECLARED. The [data-preset][data-theme] selector has
  // higher specificity than [data-theme] alone, so a preset overrides defaults.
  const css = `/* ============================================================
   Design System — Theme Tokens
   Auto-generated from tokens.json. DO NOT EDIT MANUALLY.
   Source of truth: src/shared/styles/tokens.json
   ============================================================ */

:root {
${staticBlock}
${compositeBlock}
}

/* Semantic touch target — adapts to primary pointer type. */
:root { --touch-target: var(--touch-target-desktop); }
@media (pointer: coarse) {
  :root { --touch-target: var(--touch-target-mobile); }
}

[data-theme="light"] {
${lightColorBlock}
${componentBlock}
}

[data-theme="dark"] {
${darkColorBlock}
${componentBlock}
}

${presetBlocks.join('\n\n')}

@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
`;

  await writeFile(cssPath, css, 'utf8');
  console.log(`Generated ${cssPath} from ${tokensPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
