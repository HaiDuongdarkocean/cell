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

function flattenStaticTokens(staticObj) {
  const lines = [];
  const push = (name, value) => {
    if (typeof value === 'number') {
      lines.push(`  --${name}: ${value};`);
    } else {
      lines.push(`  --${name}: ${value};`);
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

  return lines.join('\n');
}

function flattenComponentTokens(componentObj) {
  const lines = [];
  for (const [component, tokens] of Object.entries(componentObj)) {
    for (const [key, value] of Object.entries(tokens)) {
      lines.push(`  --${component}-${key}: ${value};`);
    }
  }
  return lines.join('\n');
}

function buildColorBlock(core, derived, mode) {
  const lines = [`  color-scheme: ${mode};`];
  for (const key of CORE_COLOR_KEYS) {
    lines.push(`  --color-${kebabCase(key)}: ${core[key]};`);
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
}
`;

  await writeFile(cssPath, css, 'utf8');
  console.log(`Generated ${cssPath} from ${tokensPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
