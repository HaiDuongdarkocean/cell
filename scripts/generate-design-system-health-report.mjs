import { readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, sep } from 'node:path';
import { glob } from 'glob';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const REPORT_JSON = resolve(ROOT, 'docs/design-system/HEALTH_REPORT.json');
const REPORT_MD = resolve(ROOT, 'docs/design-system/HEALTH_REPORT.md');
const INVENTORY_PATH = resolve(ROOT, 'docs/design-system/COMPONENT_INVENTORY.json');

function relativePath(file) {
  return relative(ROOT, file).split(sep).join('/');
}

async function runCssAudit() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/check-design-system-css.mjs'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });
    child.on('error', (err) => reject(err));
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`CSS audit killed by signal ${signal}`));
        return;
      }
      if (code !== 0 && !output.includes('Found ')) {
        reject(new Error(`CSS audit exited ${code}: ${output}`));
        return;
      }
      resolve(output);
    });
  });
}

function parseCssAudit(output) {
  const findings = [];
  const byRule = {};
  for (const line of output.split('\n')) {
    if (line.startsWith('Found ')) {
      const m = line.match(/Found (\d+) violation/);
      if (m) byRule._total = parseInt(m[1], 10);
      const summary = line.split('. ').pop() || '';
      for (const part of summary.split(' ')) {
        const [rule, count] = part.split('=');
        if (rule && count && !Number.isNaN(Number(count))) {
          byRule[rule] = parseInt(count, 10);
        }
      }
    } else if (line.includes('\t')) {
      const parts = line.split('\t');
      if (parts.length >= 4) {
        findings.push({
          file: parts[0],
          rule: parts[1],
          detail: parts[2],
          selector: parts[3],
          snippet: parts[4] || '',
        });
      }
    }
  }
  return { findings, byRule };
}

function isProductionTsx(rel) {
  return !(
    rel.startsWith('src/shared/ui/') ||
    rel.startsWith('src/shared/icons/') ||
    rel.startsWith('src/entrypoints/design-system-showcase/') ||
    rel.startsWith('src/entrypoints/mock-') ||
    rel.startsWith('src/entrypoints/mockup-') ||
    rel.startsWith('src/entrypoints/test/') ||
    rel.includes('.showcase.') ||
    rel.includes('.stories.') ||
    rel.includes('.test.') ||
    rel.includes('node_modules')
  );
}

function hasJsx(content) {
  return content.includes('</') || content.includes('/>');
}

function hasJsxUsage(content, importNames) {
  for (const name of importNames) {
    const re = new RegExp('<\\s*\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    if (re.test(content)) return true;
  }
  return false;
}

function extractSharedUiImports(content) {
  const names = [];
  const importRe = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"]@\/shared\/ui['"]/g;
  for (const match of content.matchAll(importRe)) {
    const block = match[1];
    for (const part of block.split(',')) {
      const clean = part.trim().split(/\s+as\s+/)[0].trim();
      if (clean && !clean.startsWith('type ')) {
        names.push(clean);
      }
    }
  }
  return [...new Set(names)];
}

async function collectAdoption() {
  const tsxFiles = await glob('src/**/*.tsx', { cwd: ROOT, absolute: true });
  const total = [];
  const consumers = [];
  const exceptions = [];
  for (const file of tsxFiles) {
    const rel = relativePath(file);
    if (!isProductionTsx(rel)) continue;
    const content = await readFile(file, 'utf8');
    if (!hasJsx(content)) continue;
    total.push(rel);
    const sharedUiImports = extractSharedUiImports(content);
    if (sharedUiImports.length > 0 && hasJsxUsage(content, sharedUiImports)) {
      consumers.push(rel);
    } else {
      exceptions.push(rel);
    }
  }
  const rate = total.length === 0 ? 0 : consumers.length / total.length;
  return {
    total: total.length,
    consumers: consumers.length,
    exceptions: exceptions.length,
    rate,
    ratePercent: Number((rate * 100).toFixed(2)),
    target: 0.95,
    targetMet: rate >= 0.95,
    exceptionList: exceptions.slice(0, 50),
  };
}

async function collectDrift() {
  const allCss = [...new Set(await glob('src/**/*.css', { cwd: ROOT, absolute: true }))];
  const m3Files = [];
  const hexFiles = [];
  const pxFiles = [];
  const zFiles = [];
  let hexCount = 0;
  let pxCount = 0;
  let zCount = 0;
  for (const file of allCss) {
    const rel = relativePath(file);
    if (
      rel.includes('tokens.css') ||
      rel.includes('node_modules') ||
      rel.includes('.test.') ||
      rel.includes('.showcase.') ||
      rel.startsWith('src/entrypoints/mock-') ||
      rel.startsWith('src/entrypoints/mockup-') ||
      rel.startsWith('src/entrypoints/design-system-showcase/')
    ) {
      continue;
    }
    const content = await readFile(file, 'utf8');
    if (content.includes('md-sys-color')) {
      m3Files.push(rel);
    }
    const hexMatches = content.match(/#[0-9a-fA-F]{3,8}/g);
    if (hexMatches) {
      hexCount += hexMatches.length;
      if (!hexFiles.includes(rel)) hexFiles.push(rel);
    }
    if (content.includes('z-index:')) {
      zCount += 1;
      if (!zFiles.includes(rel)) zFiles.push(rel);
    }
    const pxMatches = content.match(/\d+px/gi);
    if (pxMatches) {
      const nonZero = pxMatches.filter((m) => m !== '0px');
      if (nonZero.length > 0) {
        pxCount += nonZero.length;
        if (!pxFiles.includes(rel)) pxFiles.push(rel);
      }
    }
  }
  return {
    m3Files: m3Files.slice(0, 20),
    hexFiles: hexFiles.slice(0, 20),
    pxFiles: pxFiles.slice(0, 20),
    zFiles: zFiles.slice(0, 20),
    m3FilesCount: m3Files.length,
    hexFilesCount: hexFiles.length,
    pxFilesCount: pxFiles.length,
    zFilesCount: zFiles.length,
    hexCount,
    pxCount,
    zCount,
  };
}

async function collectInlineSvg() {
  const tsxFiles = await glob('src/**/*.tsx', { cwd: ROOT, absolute: true });
  const files = [];
  let count = 0;
  for (const file of tsxFiles) {
    const rel = relativePath(file);
    if (
      rel.startsWith('src/shared/icons/') ||
      rel.startsWith('src/shared/ui/') ||
      rel.startsWith('src/entrypoints/mock-') ||
      rel.startsWith('src/entrypoints/mockup-') ||
      rel.startsWith('src/entrypoints/design-system-showcase/') ||
      rel.startsWith('src/entrypoints/test/') ||
      rel.includes('.showcase.') ||
      rel.includes('.stories.') ||
      rel.includes('.test.')
    ) {
      continue;
    }
    const content = await readFile(file, 'utf8');
    if (content.includes('<svg')) {
      const matches = content.match(/<svg/g);
      const c = matches ? matches.length : 0;
      count += c;
      files.push({ file: rel, count: c });
    }
  }
  return { count, files: files.slice(0, 20) };
}

async function collectEvidence() {
  const inventory = JSON.parse(await readFile(INVENTORY_PATH, 'utf8'));
  return {
    summary: inventory.summary,
    zeroConsumerPublicExports: inventory.gaps?.zeroConsumer || [],
  };
}

async function newestMatchingFile(pattern) {
  const files = await glob(pattern, { cwd: ROOT, absolute: true });
  if (files.length === 0) return null;
  const withMtime = await Promise.all(
    files.map(async (file) => ({ file, mtime: (await stat(file)).mtimeMs })),
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return withMtime[0].file;
}

async function collectBundle() {
  const distUi = await newestMatchingFile('dist/assets/ui-*.js');
  const distTokens = await newestMatchingFile('dist/assets/tokens-*.js');
  const ui = distUi ? { file: relativePath(distUi), bytes: (await stat(distUi)).size } : null;
  const tokens = distTokens ? { file: relativePath(distTokens), bytes: (await stat(distTokens)).size } : null;
  return { ui, tokens };
}

function summarize(adoption, drift, inlineSvg, evidence, cssAudit) {
  const failures = [];
  const warnings = [];
  if (!adoption.targetMet) {
    warnings.push('Shared UI adoption ' + adoption.ratePercent + '% below 95% target');
  }
  if (drift.m3FilesCount > 0) {
    failures.push('M3 tokens in ' + drift.m3FilesCount + ' files');
  }
  if (drift.hexFilesCount > 0) {
    warnings.push('Hardcoded hex colors in ' + drift.hexFilesCount + ' files');
  }
  if (drift.zFilesCount > 0) {
    warnings.push('Hardcoded z-index in ' + drift.zFilesCount + ' files');
  }
  if (inlineSvg.count > 0) {
    warnings.push(inlineSvg.count + ' inline <svg> in production TSX');
  }
  if (evidence.zeroConsumerPublicExports.length > 0) {
    warnings.push(evidence.zeroConsumerPublicExports.length + ' public UI exports have showcase+test but 0 consumers');
  }
  const undefinedTokenCount = cssAudit.byRule['undefined-token'] || 0;
  if (undefinedTokenCount > 0) {
    warnings.push(undefinedTokenCount + ' undefined-token violations in shared UI (pre-existing drift)');
  }
  let status = 'pass';
  if (warnings.length > 0) status = 'warn';
  if (failures.length > 0) status = 'fail';
  return { status, failures, warnings };
}

async function inventorySourcesMaxMtime() {
  const sourceFiles = await glob('src/shared/ui/*.tsx', { cwd: ROOT, absolute: true });
  const showcaseFiles = await glob('src/shared/ui/*.showcase.tsx', { cwd: ROOT, absolute: true });
  const all = [...sourceFiles, ...showcaseFiles];
  if (all.length === 0) return 0;
  const mtimes = await Promise.all(all.map((f) => stat(f).then((s) => s.mtimeMs)));
  return Math.max(...mtimes);
}

async function ensureInventoryFresh() {
  if (!existsSync(INVENTORY_PATH)) {
    await generateInventory();
    return;
  }
  const inventoryMtime = (await stat(INVENTORY_PATH)).mtimeMs;
  const sourceMtime = await inventorySourcesMaxMtime();
  if (sourceMtime > inventoryMtime) {
    await generateInventory();
  }
}

function generateInventory() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/generate-component-inventory.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Inventory generator killed by signal ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`Inventory generator exited ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  await ensureInventoryFresh();
  const [adoption, drift, inlineSvg, evidence, bundle, cssOutput] = await Promise.all([
    collectAdoption(),
    collectDrift(),
    collectInlineSvg(),
    collectEvidence(),
    collectBundle(),
    runCssAudit(),
  ]);
  const cssAudit = parseCssAudit(cssOutput);
  const summary = summarize(adoption, drift, inlineSvg, evidence, cssAudit);

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    adoption,
    tokenHealth: {
      cssAudit: {
        total: cssAudit.byRule._total || 0,
        byRule: cssAudit.byRule,
      },
      drift,
      inlineSvg,
    },
    evidence,
    bundle,
  };

  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const lines = [
    '# Cell Design System Health Report',
    '',
    '> Generated at ' + report.generatedAt,
    '> Overall status: **' + summary.status.toUpperCase() + '**',
    '',
    '## Summary',
    '',
    ...summary.failures.map((f) => '- ' + f),
    ...summary.warnings.map((w) => '- ' + w),
    ...(summary.failures.length === 0 && summary.warnings.length === 0 ? ['- No health issues detected.'] : []),
    '',
    '## Shared UI adoption',
    '',
    '- Production TSX files: **' + adoption.total + '**',
    '- Files using shared UI components as JSX: **' + adoption.consumers + '**',
    '- Adoption rate: **' + adoption.ratePercent + '%** (target >= 95%; metric counts production TSX with JSX that renders at least one imported shared UI component)',
    '- Target met: **' + (adoption.targetMet ? 'Yes' : 'No') + '**',
    '',
    ...(adoption.targetMet ? [] : ['### Exceptions (' + adoption.exceptions + ')', ...adoption.exceptionList.map((f) => '- `' + f + '`'), '']),
    '## Token & drift health',
    '',
    '| Metric | Count |',
    '|---|---|',
    '| M3 token files | ' + drift.m3FilesCount + ' |',
    '| Hardcoded hex values | ' + drift.hexCount + ' |',
    '| Hardcoded z-index declarations | ' + drift.zCount + ' |',
    '| Non-zero px values | ' + drift.pxCount + ' |',
    '| Inline <svg> in production TSX | ' + inlineSvg.count + ' |',
    '| Undefined-token violations (shared UI) | ' + (cssAudit.byRule['undefined-token'] || 0) + ' |',
    '',
    '### CSS audit rule breakdown',
    '',
    '| Rule | Count |',
    '|---|---|',
    ...Object.entries(cssAudit.byRule)
      .filter(([k]) => k !== '_total')
      .map(([rule, count]) => '| ' + rule + ' | ' + count + ' |'),
    '',
    '## Component evidence gaps',
    '',
    '- Total public exports: **' + evidence.summary.total + '**',
    '- Stable: **' + evidence.summary.stable + '**',
    '- Experimental: **' + evidence.summary.experimental + '**',
    '- Missing showcase: **' + evidence.summary.needsShowcase + '**',
    '- Missing test: **' + evidence.summary.needsTest + '**',
    '- Zero consumers: **' + evidence.summary.zeroConsumer + '**',
    '- Orphan showcases: **' + evidence.summary.orphanShowcases + '**',
    '',
    ...(evidence.zeroConsumerPublicExports.length > 0 ? ['### Public UI exports ready but with 0 consumers (' + evidence.zeroConsumerPublicExports.length + ')', ...evidence.zeroConsumerPublicExports.map((n) => '- ' + n), ''] : []),
    '## Bundle impact',
    '',
    bundle.ui ? '- `' + bundle.ui.file + '`: ' + bundle.ui.bytes.toLocaleString() + ' bytes' : '- UI bundle not found; run `npm run build` first.',
    bundle.tokens ? '- `' + bundle.tokens.file + '`: ' + bundle.tokens.bytes.toLocaleString() + ' bytes' : '- Tokens bundle not found; run `npm run build` first.',
    '',
    '## Visual flake',
    '',
    '> Not yet automated. Track via Playwright test-retries and visual snapshot review.',
    '',
    '## Deliberate / accepted violations',
    '',
    '- Undefined-token violations in `src/shared/ui/*.module.css` are pre-existing token drift; the CSS audit is non-blocking in CI.',
    '- Hardcoded values in `src/entrypoints/mock-*/mockup-*` pages are excluded from production health counts.',
    '',
  ].filter(Boolean);

  await writeFile(REPORT_MD, lines.join('\n') + '\n', 'utf8');

  console.log('Wrote ' + relativePath(REPORT_JSON));
  console.log('Wrote ' + relativePath(REPORT_MD));
  console.log('Status: ' + summary.status);
  if (summary.failures.length > 0) {
    for (const f of summary.failures) console.log('FAIL: ' + f);
    process.exit(1);
  }
  if (summary.warnings.length > 0) {
    for (const w of summary.warnings) console.log('WARN: ' + w);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
