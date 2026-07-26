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

  // spacing
  for (const [key, value] of Object.entries(staticObj.spacing)) {
    push(`space-${key}`, value);
  }

  // radius
  for (const [key, value] of Object.entries(staticObj.radius)) {
    push(`radius-${key}`, value);
  }

  // shadow
  for (const [key, value] of Object.entries(staticObj.shadow)) {
    push(`shadow-${key}`, value);
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

async function main() {
  const tokensPath = join(__dirname, '..', 'src', 'shared', 'styles', 'tokens.json');
  const cssPath = join(__dirname, '..', 'src', 'shared', 'styles', 'tokens.css');

  const tokens = JSON.parse(await readFile(tokensPath, 'utf8'));

  const staticBlock = flattenStaticTokens(tokens.static);
  const componentBlock = flattenComponentTokens(tokens.component);
  const lightColorBlock = buildColorBlock(tokens.core.light, tokens.derived.light, 'light');
  const darkColorBlock = buildColorBlock(tokens.core.dark, tokens.derived.dark, 'dark');

  // componentBlock is duplicated in [data-theme="dark"] because CSS custom
  // properties resolve at the element where they are DECLARED, not where they
  // are used. --button-bg: var(--color-primary) in :root freezes to light's
  // --color-primary. Re-declaring in [data-theme="dark"] forces re-resolution
  // with dark colors. Critical for Shadow DOM where data-theme is on a
  // descendant of :root (shadow host), not on :root itself.
  const css = `/* ============================================================
   Design System — Theme Tokens
   Auto-generated from tokens.json. DO NOT EDIT MANUALLY.
   Source of truth: src/shared/styles/tokens.json
   ============================================================ */

:root {
${lightColorBlock}
${staticBlock}
${componentBlock}
}

[data-theme="dark"] {
${darkColorBlock}
${componentBlock}
}

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
