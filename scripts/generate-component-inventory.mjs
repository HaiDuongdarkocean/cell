#!/usr/bin/env node
/**
 * Generate a public component inventory from `src/shared/ui/index.ts`.
 *
 * Output:
 * - docs/design-system/COMPONENT_INVENTORY.json
 * - docs/design-system/COMPONENT_INVENTORY.md
 *
 * Derives level/category/title from the canonical auto-discovery helpers.
 * Detects missing showcase/test, zero-consumer stable exports, and orphan showcases.
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const jiti = createJiti(import.meta.url);

const {
  CANONICAL_META,
  applyMetadata,
} = await jiti.import(join(root, 'src/entrypoints/design-system-showcase/autoDiscovery.logic.ts'));

const UI_DIR = join(root, 'src/shared/ui');
const INDEX_FILE = join(UI_DIR, 'index.ts');
const DOCS_DIR = join(root, 'docs/design-system');
const JSON_OUT = join(DOCS_DIR, 'COMPONENT_INVENTORY.json');
const MD_OUT = join(DOCS_DIR, 'COMPONENT_INVENTORY.md');

const EXCLUDED_DIRS = [
  'src/shared/ui/__snapshots__',
  'src/entrypoints/design-system-showcase',
  'src/entrypoints/mock-',
  'src/entrypoints/mockup-',
  'src/entrypoints/test',
  'tests',
  'e2e',
  'scripts',
  'docs',
  'dist',
  'node_modules',
];

const EXCLUDED_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.showcase\.(ts|tsx)$/,
  /\.style-guard\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getPublicExports() {
  const indexText = await readFile(INDEX_FILE, 'utf-8');
  const exports = [];

  const namedFromRe = /export\s+\{\s*([^}]+?)\s*\}\s+from\s+['"]\.\/([^'"]+)['"];?/g;
  for (const match of indexText.matchAll(namedFromRe)) {
    const namesBlock = match[1];
    const source = match[2];
    const names = namesBlock.split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      const isType = name.startsWith('type ');
      const exportName = isType ? name.slice(5).trim() : name;
      exports.push({
        name: exportName,
        source,
        isType,
      });
    }
  }

  return exports;
}

async function getAllSourceFiles() {
  const files = await readdir(UI_DIR, { withFileTypes: true });
  const result = [];
  for (const entry of files) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.tsx')) continue;
    if (entry.name.endsWith('.showcase.tsx') || entry.name.endsWith('.test.tsx')) continue;
    const base = entry.name.replace(/\.tsx$/, '');
    if (base === 'index') continue;
    result.push(base);
  }
  return result;
}

async function getSourceFiles() {
  const sourceSet = new Set();
  const publicExports = await getPublicExports();
  publicExports.forEach((e) => sourceSet.add(e.source));

  const all = await getAllSourceFiles();
  return {
    publicSources: Array.from(sourceSet).sort(),
    allSources: all,
  };
}

async function collectSourceFiles() {
  const result = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const rel = relative(root, full).split(sep).join('/');
        if (EXCLUDED_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`))) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const rel = relative(root, full).split(sep).join('/');
        if (EXCLUDED_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`))) continue;
        if (EXCLUDED_PATTERNS.some((p) => p.test(entry.name))) continue;
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        result.push(full);
      }
    }
  }

  await walk(root);
  return result;
}

async function countUsage(exportName, sourceBase, allFiles) {
  const importRe = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${escapeRegExp(exportName)}\\b[^}]*\\}\\s+from\\s+['"]@/shared/ui(?:/[^'"]*)?['"];?`,
  );

  const consumers = [];
  const sourceOwnPattern = new RegExp(`(^|/)src/shared/ui/${escapeRegExp(sourceBase)}\\.`);

  for (const file of allFiles) {
    const rel = relative(root, file).split(sep).join('/');
    if (sourceOwnPattern.test(rel)) continue;
    if (rel === 'src/shared/ui/index.ts') continue;
    const text = await readFile(file, 'utf-8');
    if (importRe.test(text)) {
      consumers.push(rel);
    }
  }

  return consumers;
}

function determineStatus({ isType, canonical, hasShowcase, hasTest, usageCount, deprecated }) {
  if (isType) return 'type-only';
  if (canonical?.hidden) return 'hidden';
  if (deprecated || canonical?.status === 'deprecated') return 'deprecated';

  if (hasShowcase && hasTest && usageCount > 0) return 'stable';
  if (hasShowcase && hasTest) return 'unused';
  if (hasShowcase) return 'needs-test';
  return 'needs-showcase';
}

async function getShowcaseMeta(sourceBase) {
  const showcasePath = join(UI_DIR, `${sourceBase}.showcase.tsx`);
  if (!existsSync(showcasePath)) return undefined;

  const text = await readFile(showcasePath, 'utf-8');
  const match = text.match(/showcaseMeta\s*=\s*(\{[\s\S]*?\n\});?/);
  if (!match) return undefined;

  try {
    // Safer than eval: use Function to parse a simple object literal.
    return Function(`return (${match[1]})`)();
  } catch {
    return undefined;
  }
}

async function buildEntry(exportName, sourceBase, isType, allFiles) {
  const filePath = join(UI_DIR, `${sourceBase}.tsx`);
  const hasModuleCss = existsSync(join(UI_DIR, `${sourceBase}.module.css`));
  const hasShowcase = existsSync(join(UI_DIR, `${sourceBase}.showcase.tsx`));
  const hasTest =
    existsSync(join(UI_DIR, `${sourceBase}.test.tsx`)) ||
    existsSync(join(UI_DIR, `${sourceBase}.style-guard.test.ts`));

  const consumers = isType ? [] : await countUsage(exportName, sourceBase, allFiles);
  const usageCount = consumers.length;

  const showcaseMeta = hasShowcase ? await getShowcaseMeta(sourceBase) : undefined;
  const canonical = CANONICAL_META[sourceBase] || {};
  const { meta, unclassified } = applyMetadata(
    `src/shared/ui/${sourceBase}.tsx`,
    showcaseMeta,
    sourceBase,
  );

  const deprecated = existsSync(filePath)
    ? (await readFile(filePath, 'utf-8')).includes('@deprecated')
    : false;

  const status = determineStatus({
    isType,
    canonical,
    hasShowcase,
    hasTest,
    usageCount,
    deprecated,
  });

  return {
    name: exportName,
    source: `src/shared/ui/${sourceBase}.tsx`,
    isPublic: true,
    isType,
    level: meta.level,
    category: meta.category,
    title: meta.title,
    description: meta.description,
    hasShowcase,
    hasTest,
    hasModuleCss,
    usageCount,
    consumers: consumers.slice(0, 10),
    status,
    unclassified,
    deprecated,
  };
}

async function buildNonPublicEntry(sourceBase, allFiles) {
  const filePath = join(UI_DIR, `${sourceBase}.tsx`);
  const hasModuleCss = existsSync(join(UI_DIR, `${sourceBase}.module.css`));
  const hasShowcase = existsSync(join(UI_DIR, `${sourceBase}.showcase.tsx`));
  const hasTest =
    existsSync(join(UI_DIR, `${sourceBase}.test.tsx`)) ||
    existsSync(join(UI_DIR, `${sourceBase}.style-guard.test.ts`));

  const consumers = await countUsage(sourceBase, sourceBase, allFiles);
  const usageCount = consumers.length;

  const showcaseMeta = hasShowcase ? await getShowcaseMeta(sourceBase) : undefined;
  const canonical = CANONICAL_META[sourceBase] || {};
  const { meta, unclassified } = applyMetadata(
    `src/shared/ui/${sourceBase}.tsx`,
    showcaseMeta,
    sourceBase,
  );

  const deprecated = existsSync(filePath)
    ? (await readFile(filePath, 'utf-8')).includes('@deprecated')
    : false;

  const status = determineStatus({
    isType: false,
    canonical,
    hasShowcase,
    hasTest,
    usageCount,
    deprecated,
  });

  return {
    name: sourceBase,
    source: `src/shared/ui/${sourceBase}.tsx`,
    isPublic: false,
    isType: false,
    level: meta.level,
    category: meta.category,
    title: meta.title,
    description: meta.description,
    hasShowcase,
    hasTest,
    hasModuleCss,
    usageCount,
    consumers: consumers.slice(0, 10),
    status,
    unclassified,
    deprecated,
  };
}

async function maxMtime(files) {
  const mtimes = await Promise.all(files.map((f) => stat(f).then((s) => s.mtimeMs).catch(() => 0)));
  return new Date(Math.max(...mtimes)).toISOString();
}

async function generateInventory() {
  const publicExports = await getPublicExports();
  const { publicSources, allSources } = await getSourceFiles();
  const publicSourceSet = new Set(publicSources);

  const allFiles = await collectSourceFiles();

  const generatedAt = await maxMtime([...allFiles, INDEX_FILE, __filename]);

  const publicEntries = [];
  for (const exp of publicExports) {
    publicEntries.push(await buildEntry(exp.name, exp.source, exp.isType, allFiles));
  }

  const nonPublicEntries = [];
  for (const source of allSources) {
    if (publicSourceSet.has(source)) continue;
    nonPublicEntries.push(await buildNonPublicEntry(source, allFiles));
  }

  const allEntries = [...publicEntries, ...nonPublicEntries];

  const missingShowcase = allEntries
    .filter((e) => !e.isType && e.status === 'needs-showcase')
    .map((e) => e.name);
  const missingTest = allEntries
    .filter((e) => !e.isType && e.status === 'needs-test')
    .map((e) => e.name);
  const zeroConsumer = allEntries
    .filter((e) => !e.isType && e.status === 'unused')
    .map((e) => e.name);
  const orphanShowcases = (await readdir(UI_DIR, { withFileTypes: true }))
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith('.showcase.tsx') &&
        !e.name.endsWith('.test.tsx') &&
        !allSources.includes(e.name.replace(/\.showcase\.tsx$/, '')),
    )
    .map((e) => e.name.replace(/\.showcase\.tsx$/, ''));

  const summary = {
    total: allEntries.length,
    public: publicEntries.length,
    nonPublic: nonPublicEntries.length,
    stable: allEntries.filter((e) => e.status === 'stable').length,
    experimental: allEntries.filter((e) => ['needs-test', 'unused'].includes(e.status)).length,
    deprecated: allEntries.filter((e) => e.status === 'deprecated' || e.deprecated).length,
    needsShowcase: missingShowcase.length,
    needsTest: missingTest.length,
    zeroConsumer: zeroConsumer.length,
    orphanShowcases: orphanShowcases.length,
  };

  const inventory = {
    generatedAt,
    summary,
    publicExports: publicEntries,
    nonPublicComponents: nonPublicEntries,
    gaps: {
      missingShowcase,
      missingTest,
      zeroConsumer,
      orphanShowcases,
    },
  };

  await writeFile(JSON_OUT, `${JSON.stringify(inventory, null, 2)}\n`, 'utf-8');

  const md = `# Component Inventory

> Auto-generated from \`src/shared/ui/index.ts\` and source files. Do not edit by hand; run \`npm run generate:component-inventory\` to refresh.

## Summary

| Metric | Count |
| --- | --- |
| Total components | ${summary.total} |
| Public exports | ${summary.public} |
| Non-public source files | ${summary.nonPublic} |
| Stable | ${summary.stable} |
| Experimental / needs evidence | ${summary.experimental} |
| Deprecated | ${summary.deprecated} |
| Missing showcase | ${summary.needsShowcase} |
| Missing test | ${summary.needsTest} |
| Zero-consumer public exports | ${summary.zeroConsumer} |
| Orphan showcases | ${summary.orphanShowcases} |

## Gaps

- **Missing showcase**: ${missingShowcase.join(', ') || 'none'}
- **Missing test**: ${missingTest.join(', ') || 'none'}
- **Zero-consumer public exports**: ${zeroConsumer.join(', ') || 'none'}
- **Orphan showcases**: ${orphanShowcases.join(', ') || 'none'}

## Public exports

| Name | Public | Level | Category | Status | Showcase | Test | Consumers |
| --- | --- | --- | --- | --- | --- | --- | --- |
${publicEntries
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(
    (e) =>
      `| ${e.name} | yes | ${e.isType ? 'type' : e.level} | ${e.category} | ${e.status} | ${e.hasShowcase ? 'yes' : 'no'} | ${e.hasTest ? 'yes' : 'no'} | ${e.usageCount} |`,
  )
  .join('\n')}

## Non-public components

| Name | Public | Level | Category | Status | Showcase | Test | Consumers |
| --- | --- | --- | --- | --- | --- | --- | --- |
${nonPublicEntries
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(
    (e) =>
      `| ${e.name} | no | ${e.level} | ${e.category} | ${e.status} | ${e.hasShowcase ? 'yes' : 'no'} | ${e.hasTest ? 'yes' : 'no'} | ${e.usageCount} |`,
  )
  .join('\n')}

## Notes

- ".Stable" = public export with a showcase, a test, and at least one production consumer.
- ".Unused" = public or non-public with showcase + test but zero production consumers.
- ".Needs-test" = has a showcase but no test file.
- ".Needs-showcase" = source file exists but no ".showcase.tsx".
`;

  await writeFile(MD_OUT, md, 'utf-8');

  return inventory;
}

generateInventory()
  .then(() => {
    console.log(`Wrote ${JSON_OUT}`);
    console.log(`Wrote ${MD_OUT}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
