import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute, relative } from 'node:path';
import { glob } from 'glob';
import postcss from 'postcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const TOKENS_JSON_PATH = resolve(ROOT, 'src/shared/styles/tokens.json');
const TOKENS_CSS_PATH = resolve(ROOT, 'src/shared/styles/tokens.css');

function kebabCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function isHex(str) {
  return typeof str === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(str);
}

/**
 * Reproduce the token naming convention used by scripts/generate-tokens.js so
 * the audit can validate `var(--*)` references against the canonical token
 * registry. Falls back to parsing the generated tokens.css when present.
 */
function buildTokenRegistryFromJson(tokens) {
  const registry = new Set();

  const addColorCore = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      const name = `color-${kebabCase(key)}`;
      registry.add(`--${name}`);
      if (isHex(value)) registry.add(`--${name}-rgb`);
    }
  };

  const addDerived = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      registry.add(`--${key}`);
      if (isHex(value)) registry.add(`--${key}-rgb`);
    }
  };

  const addComponent = (component, props) => {
    for (const [key, value] of Object.entries(props)) {
      registry.add(`--${component}-${key}`);
      if (isHex(value)) registry.add(`--${component}-${key}-rgb`);
    }
  };

  const addStatic = (staticObj) => {
    if (!staticObj) return;

    if (staticObj.font) {
      registry.add('--font-family');
      registry.add('--font-family-body');
      registry.add('--font-family-heading');
      registry.add('--font-family-code');
      registry.add('--font-family-mono');
      for (const key of Object.keys(staticObj.font.sizes ?? {})) {
        registry.add(`--font-size-${key}`);
      }
      for (const key of Object.keys(staticObj.font.weights ?? {})) {
        registry.add(`--font-weight-${key}`);
      }
      for (const key of Object.keys(staticObj.font.leading ?? {})) {
        registry.add(`--leading-${key}`);
      }
      for (const key of Object.keys(staticObj.font.tracking ?? {})) {
        registry.add(`--tracking-${key}`);
      }
    }

    for (const key of Object.keys(staticObj.spacing ?? {})) {
      registry.add(`--space-${key}`);
    }
    for (const key of Object.keys(staticObj.size ?? {})) {
      registry.add(`--size-${key}`);
    }
    for (const key of Object.keys(staticObj.avatar ?? {})) {
      registry.add(`--avatar-${key}`);
    }
    for (const key of Object.keys(staticObj.radius ?? {})) {
      registry.add(`--radius-${key}`);
    }
    for (const key of Object.keys(staticObj.shadow ?? {})) {
      registry.add(`--shadow-${key}`);
    }
    for (const key of Object.keys(staticObj.borderWidth ?? {})) {
      registry.add(`--border-width-${key}`);
    }
    for (const key of Object.keys(staticObj.strokeWidth ?? {})) {
      registry.add(`--stroke-width-${key}`);
    }
    for (const key of Object.keys(staticObj.blur ?? {})) {
      registry.add(`--blur-${key}`);
    }
    for (const key of Object.keys(staticObj.opacity ?? {})) {
      registry.add(`--opacity-${key}`);
    }
    for (const key of Object.keys(staticObj.motion ?? {})) {
      registry.add(`--${key}`);
    }
    for (const key of Object.keys(staticObj.zIndex ?? {})) {
      registry.add(`--z-${key}`);
    }
    for (const key of Object.keys(staticObj.navCluster ?? {})) {
      registry.add(`--nav-cluster-${key}`);
    }
    for (const key of Object.keys(staticObj.touchTarget ?? {})) {
      registry.add(`--touch-target-${key}`);
    }
    registry.add('--touch-target');
    for (const key of Object.keys(staticObj.popupImage ?? {})) {
      registry.add(`--popup-image-${key}`);
    }
    for (const key of Object.keys(staticObj.overlay ?? {})) {
      registry.add(`--overlay-${key}`);
    }
  };

  const addComposite = (composite) => {
    for (const [name, _value] of Object.entries(composite)) {
      registry.add(`--${name}-font-size`);
      registry.add(`--${name}-font-weight`);
      registry.add(`--${name}-line-height`);
      registry.add(`--${name}-letter-spacing`);
    }
  };

  if (tokens.core) {
    for (const mode of ['light', 'dark']) {
      if (tokens.core[mode]) addColorCore(tokens.core[mode]);
    }
  }

  if (tokens.derived) {
    for (const mode of ['light', 'dark']) {
      if (tokens.derived[mode]) addDerived(tokens.derived[mode]);
    }
  }

  if (tokens.static) {
    addStatic(tokens.static);
  }

  if (tokens.component) {
    for (const [component, props] of Object.entries(tokens.component)) {
      addComponent(component, props);
    }
  }

  if (tokens.composite) {
    addComposite(tokens.composite);
  }

  if (tokens.presets) {
    for (const preset of Object.values(tokens.presets)) {
      for (const mode of ['light', 'dark']) {
        if (preset.core?.[mode]) addColorCore(preset.core[mode]);
        if (preset.derived?.[mode]) addDerived(preset.derived[mode]);
      }
      if (preset.static) addStatic(preset.static);
      if (preset.component) {
        for (const [component, props] of Object.entries(preset.component)) {
          addComponent(component, props);
        }
      }
      if (preset.composite) addComposite(preset.composite);
    }
  }

  return registry;
}

async function loadTokenRegistry() {
  const registry = new Set();

  try {
    const tokens = JSON.parse(await readFile(TOKENS_JSON_PATH, 'utf8'));
    const fromJson = buildTokenRegistryFromJson(tokens);
    for (const name of fromJson) registry.add(name);
  } catch (err) {
    console.warn(`Could not load ${TOKENS_JSON_PATH}: ${err.message}`);
  }

  try {
    const css = await readFile(TOKENS_CSS_PATH, 'utf8');
    for (const line of css.split('\n')) {
      const match = line.match(/^\s*(--[\w-]+)\s*:/);
      if (match) registry.add(match[1]);
    }
  } catch {
    // tokens.css may not exist; tokens.json is the canonical source.
  }

  return registry;
}

function relativePath(file) {
  return relative(ROOT, file).replace(/\\/g, '/');
}

function shouldExclude(file) {
  const normalized = file.replace(/\\/g, '/');
  const name = normalized.split('/').pop();
  return (
    name.endsWith('.showcase.module.css') ||
    normalized.includes('/src/entrypoints/design-system-showcase/') ||
    normalized.includes('/src/features/')
  );
}

async function findTargetFiles(inputPath) {
  if (!inputPath) {
    return (await glob('src/shared/ui/*.module.css', { cwd: ROOT, absolute: true })).filter(
      (f) => !shouldExclude(f),
    );
  }

  const resolved = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);
  const info = await stat(resolved).catch(() => null);

  if (info?.isFile()) {
    return shouldExclude(resolved) ? [] : [resolved];
  }

  if (info?.isDirectory()) {
    return (await glob('**/*.module.css', { cwd: resolved, absolute: true })).filter(
      (f) => !shouldExclude(f),
    );
  }

  return [];
}

/**
 * Find top-level `var(` and `calc(` ranges in a declaration value.
 * Nested calls are treated as part of the outermost range so that a
 * fallback such as `var(--x, var(--y))` is fully protected.
 */
function findProtectedRanges(value, types) {
  const ranges = [];
  const lower = value.toLowerCase();
  let i = 0;
  while (i < value.length) {
    const rest = lower.slice(i);
    const matched = types.find((t) => rest.startsWith(`${t}(`));
    if (matched) {
      const start = i;
      i += matched.length + 1;
      let depth = 1;
      while (i < value.length && depth > 0) {
        if (value[i] === '(') depth += 1;
        else if (value[i] === ')') depth -= 1;
        i += 1;
      }
      ranges.push([start, i]);
    } else {
      i += 1;
    }
  }
  return ranges;
}

function isInsideRange(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

const NUMBER_UNIT_RE = /(?<![\w.])-?\d*\.?\d+\s*(px|rem)(?![\w.])/gi;
const PX_RE = /(?<![\w.])-?\d*\.?\d+\s*px(?![\w.])/gi;
const PERCENT_RE = /(?<![\w.])\d*\.?\d+\s*%(?![\w.])/gi;
const Z_INDEX_RE = /(?<![\w.])(-?\d+)(?![\w.])/g;
const COLOR_RE_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_RE_RGB = /\brgb\([^)]*\)/gi;
const COLOR_RE_RGBA = /\brgba\([^)]*\)/gi;
const COLOR_RE_HSL = /\bhsl\([^)]*\)/gi;
const COLOR_RE_HSLA = /\bhsla\([^)]*\)/gi;
const VAR_RE = /var\(\s*--([\w-]+)/g;

function normalizeMatch(match) {
  return match.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parentName(decl) {
  const parent = decl.parent;
  if (!parent) return '';
  if (parent.type === 'rule') return parent.selector;
  if (parent.type === 'atrule') return `@${parent.name} ${parent.params}`;
  return '';
}

function formatFinding(file, decl, rule, detail) {
  const rel = relativePath(file);
  const line = decl.source?.start?.line ?? 0;
  const column = decl.source?.start?.column ?? 0;
  const snippet = `${decl.prop}: ${decl.value}`;
  const trimmed = snippet.length > 140 ? `${snippet.slice(0, 140)}...` : snippet;
  return `${rel}:${line}:${column}\t${rule}\t${detail}\t${parentName(decl)}\t${trimmed}`;
}

function auditDeclaration(file, decl, registry, localProps) {
  const findings = [];
  const allVars = new Set([...registry, ...localProps]);
  const value = decl.value;

  // Undefined token: any var() not in the registry or defined in this file.
  if (decl.prop.startsWith('--')) {
    // Custom property definitions are not var() references.
  } else {
    let varMatch;
    VAR_RE.lastIndex = 0;
    const seen = new Set();
    while ((varMatch = VAR_RE.exec(value)) !== null) {
      const name = varMatch[1];
      if (!allVars.has(`--${name}`) && !seen.has(name)) {
        seen.add(name);
        findings.push(formatFinding(file, decl, 'undefined-token', `var(--${name})`));
      }
    }
  }

  // Hardcoded colors: hex, rgb, rgba, hsl, hsla outside var() fallback.
  const colorVarRanges = findProtectedRanges(value, ['var']);
  for (const re of [COLOR_RE_HEX, COLOR_RE_RGB, COLOR_RE_RGBA, COLOR_RE_HSL, COLOR_RE_HSLA]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(value)) !== null) {
      if (!isInsideRange(match.index, colorVarRanges)) {
        findings.push(formatFinding(file, decl, 'hardcoded-color', normalizeMatch(match[0])));
      }
    }
  }

  // Hardcoded spacing: padding, margin, gap with numeric px/rem outside calc()/var().
  const isSpacingProp =
    decl.prop === 'gap' ||
    decl.prop.endsWith('-gap') ||
    decl.prop.startsWith('padding') ||
    decl.prop.startsWith('margin');

  if (isSpacingProp) {
    const spacingRanges = findProtectedRanges(value, ['var', 'calc']);
    NUMBER_UNIT_RE.lastIndex = 0;
    let match;
    while ((match = NUMBER_UNIT_RE.exec(value)) !== null) {
      if (isInsideRange(match.index, spacingRanges)) continue;
      const number = parseFloat(match[0]);
      if (number === 0 || Object.is(number, -0)) continue;
      findings.push(formatFinding(file, decl, 'hardcoded-spacing', match[0].trim()));
    }
  }

  // Hardcoded radius: border-radius with numeric px or % other than 50% outside var().
  const isRadiusProp = decl.prop === 'border-radius' || decl.prop.endsWith('-radius');
  if (isRadiusProp) {
    const radiusVarRanges = findProtectedRanges(value, ['var']);

    PX_RE.lastIndex = 0;
    let match;
    while ((match = PX_RE.exec(value)) !== null) {
      if (isInsideRange(match.index, radiusVarRanges)) continue;
      const number = parseFloat(match[0]);
      if (number === 0 || Object.is(number, -0)) continue;
      findings.push(formatFinding(file, decl, 'hardcoded-radius', match[0].trim()));
    }

    PERCENT_RE.lastIndex = 0;
    while ((match = PERCENT_RE.exec(value)) !== null) {
      if (isInsideRange(match.index, radiusVarRanges)) continue;
      const number = parseFloat(match[0]);
      if (number === 50) continue;
      findings.push(formatFinding(file, decl, 'hardcoded-radius', match[0].trim()));
    }
  }

  // Hardcoded z-index: numeric values other than 0 or 1 outside var().
  if (decl.prop === 'z-index') {
    const zVarRanges = findProtectedRanges(value, ['var']);
    Z_INDEX_RE.lastIndex = 0;
    let match;
    while ((match = Z_INDEX_RE.exec(value)) !== null) {
      if (isInsideRange(match.index, zVarRanges)) continue;
      const number = parseInt(match[0], 10);
      if (number === 0 || number === 1) continue;
      findings.push(formatFinding(file, decl, 'hardcoded-z-index', match[0]));
    }
  }

  return findings;
}

async function auditFile(file, registry) {
  const css = await readFile(file, 'utf8');
  let root;
  try {
    root = postcss.parse(css, { from: file });
  } catch (err) {
    return [
      `${relativePath(file)}:1:1\tparse-error\t${err.message.replace(/\n/g, ' ')}\t\t`,
    ];
  }

  const localProps = new Set();
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) {
      localProps.add(decl.prop);
    }
  });

  const findings = [];
  root.walkDecls((decl) => {
    findings.push(...auditDeclaration(file, decl, registry, localProps));
  });

  return findings;
}

async function main() {
  const inputPath = process.argv[2];
  const files = await findTargetFiles(inputPath);

  if (files.length === 0) {
    console.log('No matching .module.css files found.');
    process.exit(0);
  }

  const registry = await loadTokenRegistry();
  const allFindings = [];

  for (const file of files) {
    const findings = await auditFile(file, registry);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    const totalFilesLabel = `${files.length} file${files.length === 1 ? '' : 's'}`;
    console.log(`0 violations (${totalFilesLabel} checked).`);
    process.exit(0);
  }

  for (const finding of allFindings) {
    console.log(finding);
  }

  const byRule = {};
  for (const finding of allFindings) {
    const rule = finding.split('\t')[1] ?? 'unknown';
    byRule[rule] = (byRule[rule] ?? 0) + 1;
  }

  const ruleSummary = Object.entries(byRule)
    .map(([rule, count]) => `${rule}=${count}`)
    .join(' ');

  const fileSet = new Set();
  for (const finding of allFindings) {
    const fileAndPos = finding.split('\t')[0];
    const lastColon = fileAndPos.lastIndexOf(':');
    const secondLast = fileAndPos.lastIndexOf(':', lastColon - 1);
    fileSet.add(fileAndPos.slice(0, secondLast));
  }

  const totalFilesLabel = `${files.length} file${files.length === 1 ? '' : 's'}`;
  console.log(
    `\nFound ${allFindings.length} violation${allFindings.length === 1 ? '' : 's'} in ${fileSet.size} file${fileSet.size === 1 ? '' : 's'} (${totalFilesLabel} checked). ${ruleSummary}`,
  );

  process.exit(1);
}

main();
