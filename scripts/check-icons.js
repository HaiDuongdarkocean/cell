#!/usr/bin/env node
/**
 * Icon QC script — validates icon design system compliance.
 *
 * Usage:
 *   node scripts/check-icons.js
 *   node scripts/check-icons.js <svg-dir> <catalog-file>
 *
 * Checks:
 * - viewBox is "0 0 24 24"
 * - stroke-width is "1.5"
 * - stroke-linecap is "round"
 * - stroke-linejoin is "round"
 * - no transforms (translate, scale)
 * - no disallowed elements (script, style, foreignObject)
 * - every .svg has exactly one ICON_CATALOG entry
 * - every catalog entry points to an existing .svg with non-empty tags
 * - no two .svg files have identical normalized content
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {Object} CatalogEntry
 * @property {string} key
 * @property {string} variable
 * @property {string | undefined} fileName
 * @property {string} source
 * @property {string[]} tags
 */

/**
 * @param {string} catalogPath
 * @returns {{ imports: Map<string, string>, entries: CatalogEntry[] }}
 */
function parseCatalog(catalogPath) {
  const text = readFileSync(catalogPath, 'utf-8');

  /** @type {Map<string, string>} */
  const imports = new Map();
  const importRegex = /^import\s+(\w+)\s+from\s+['"]\.\/svg\/([\w-]+)\.svg\?raw['"];?/gm;
  let match;
  while ((match = importRegex.exec(text)) !== null) {
    const variable = match[1];
    const fileName = `${match[2]}.svg`;
    imports.set(variable, fileName);
  }

  /** @type {CatalogEntry[]} */
  const entries = [];
  const catalogRegex = /^\s*([a-zA-Z_$][\w$]*)\s*:\s*\{\s*svg:\s*(\w+)\s*,\s*source:\s*['"]([^'"]+)['"]\s*,\s*tags:\s*\[([\s\S]*?)\]\s*\}(?:\s+as\s+IconEntry)?\s*,?/gm;
  while ((match = catalogRegex.exec(text)) !== null) {
    const key = match[1];
    const variable = match[2];
    const source = match[3];
    const tagsText = match[4];

    /** @type {string[]} */
    const tags = [];
    const tagRegex = /['"]([^'"]*)['"]/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(tagsText)) !== null) {
      tags.push(tagMatch[1].trim());
    }

    entries.push({
      key,
      variable,
      fileName: imports.get(variable),
      source,
      tags,
    });
  }

  return { imports, entries };
}

/**
 * @param {string} content
 * @returns {string[]}
 */
function checkIconGeometry(content) {
  /** @type {string[]} */
  const errors = [];

  if (!content.includes('viewBox="0 0 24 24"')) {
    errors.push('Missing or incorrect viewBox (must be "0 0 24 24")');
  }

  if (!content.includes('stroke-width="1.5"')) {
    errors.push('Missing or incorrect stroke-width (must be "1.5")');
  }

  if (!content.includes('stroke-linecap="round"')) {
    errors.push('Missing or incorrect stroke-linecap (must be "round")');
  }

  if (!content.includes('stroke-linejoin="round"')) {
    errors.push('Missing or incorrect stroke-linejoin (must be "round")');
  }

  if (content.includes('transform=') || content.includes('translate(') || content.includes('scale(')) {
    errors.push('Contains transform/translate/scale (not allowed)');
  }

  if (content.includes('<script') || content.includes('<style') || content.includes('<foreignObject')) {
    errors.push('Contains disallowed element (script, style, foreignObject)');
  }

  return errors;
}

/**
 * Normalize SVG markup so that files differing only in whitespace,
 * formatting or comments compare equal.
 *
 * @param {string} content
 * @returns {string}
 */
function normalizeSvg(content) {
  let normalized = content;

  // Remove XML comments.
  normalized = normalized.replace(/<!--[\s\S]*?-->/g, '');

  // Normalize spaces before self-closing tags.
  normalized = normalized.replace(/\s*\/>/g, '/>');

  // Sort attributes inside every start tag for a stable canonical form.
  normalized = normalized.replace(/<([a-zA-Z][\w-]*)([^>]*)>/g, (fullTag, tagName, attrPart) => {
    /** @type {{ name: string; value?: string }[]} */
    const attrs = [];
    const attrRegex = /\s+([a-zA-Z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrPart)) !== null) {
      const name = attrMatch[1];
      const value = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
      attrs.push({ name, value });
    }

    attrs.sort((a, b) => a.name.localeCompare(b.name));
    const attrString = attrs
      .map((attr) => (attr.value === undefined ? ` ${attr.name}` : ` ${attr.name}="${attr.value}"`))
      .join('');

    const isSelfClosing = attrPart.trimEnd().endsWith('/');
    return isSelfClosing ? `<${tagName}${attrString}/>` : `<${tagName}${attrString}>`;
  });

  // Remove whitespace between adjacent tags, then trim leading/trailing whitespace.
  normalized = normalized.replace(/>\s+</g, '><').trim();

  return normalized;
}

/**
 * Run all icon QC checks.
 *
 * @param {string} svgDir
 * @param {string} catalogPath
 * @returns {{ ok: boolean; messages: string[]; counts: { files: number; catalogEntries: number } }}
 */
export function checkIcons(svgDir, catalogPath) {
  const { entries } = parseCatalog(catalogPath);
  const files = readdirSync(svgDir).filter((file) => file.endsWith('.svg'));
  const fileSet = new Set(files);

  /** @type {Map<string, string>} */
  const fileContents = new Map();
  for (const file of files) {
    fileContents.set(file, readFileSync(join(svgDir, file), 'utf-8'));
  }

  /** @type {Map<string, string[]>} */
  const fileToKeys = new Map();
  /** @type {string[]} */
  const catalogErrors = [];

  for (const entry of entries) {
    if (!entry.fileName) {
      catalogErrors.push(
        `Dead catalog entry "${entry.key}": variable "${entry.variable}" has no matching import`,
      );
      continue;
    }

    if (!fileSet.has(entry.fileName)) {
      catalogErrors.push(
        `Dead catalog entry "${entry.key}": referenced SVG "${entry.fileName}" does not exist`,
      );
      continue;
    }

    if (entry.tags.length === 0 || entry.tags.some((tag) => tag === '')) {
      catalogErrors.push(`Empty tags in catalog entry "${entry.key}"`);
    }

    const keys = fileToKeys.get(entry.fileName) || [];
    keys.push(entry.key);
    fileToKeys.set(entry.fileName, keys);
  }

  /** @type {string[]} */
  const integrityErrors = [];
  /** @type {string[]} */
  const geometryErrors = [];

  for (const file of files) {
    const content = fileContents.get(file);
    if (!content) {
      continue;
    }

    for (const error of checkIconGeometry(content)) {
      geometryErrors.push(`${file}: ${error}`);
    }

    const keys = fileToKeys.get(file);
    if (!keys || keys.length === 0) {
      integrityErrors.push(`Missing catalog entry: "${file}" is not referenced by any ICON_CATALOG entry`);
    } else if (keys.length > 1) {
      integrityErrors.push(
        `Duplicate catalog reference: "${file}" is used by entries [${keys.join(', ')}]`,
      );
    }
  }

  /** @type {Map<string, string[]>} */
  const normalizedToFiles = new Map();
  for (const file of files) {
    const content = fileContents.get(file);
    if (!content) {
      continue;
    }

    const normalized = normalizeSvg(content);
    const list = normalizedToFiles.get(normalized) || [];
    list.push(file);
    normalizedToFiles.set(normalized, list);
  }

  /** @type {string[]} */
  const duplicateErrors = [];
  for (const duplicateFiles of normalizedToFiles.values()) {
    if (duplicateFiles.length > 1) {
      const details = duplicateFiles.map((file) => {
        const keys = fileToKeys.get(file) || [];
        const keyLabel = keys.length > 0 ? keys.join(', ') : 'none';
        return `"${file}" (keys: ${keyLabel})`;
      });
      duplicateErrors.push(`Duplicate SVG content across files: ${details.join(', ')}`);
    }
  }

  const messages = [
    ...geometryErrors,
    ...integrityErrors,
    ...catalogErrors,
    ...duplicateErrors,
  ];

  return {
    ok: messages.length === 0,
    messages,
    counts: {
      files: files.length,
      catalogEntries: entries.length,
    },
  };
}

function main() {
  const svgDir = process.argv[2]
    ? resolve(process.argv[2])
    : join(process.cwd(), 'src/shared/icons/svg');
  const catalogPath = process.argv[3]
    ? resolve(process.argv[3])
    : join(process.cwd(), 'src/shared/icons/index.ts');

  const result = checkIcons(svgDir, catalogPath);

  if (result.ok) {
    console.log(`✓ All ${result.counts.files} icons pass QC checks`);
    process.exit(0);
  }

  console.error(`\n❌ ${result.messages.length} icon QC error(s) found:\n`);
  for (const message of result.messages) {
    console.error(`  ${message}`);
  }
  console.error(`\n  Checked ${result.counts.files} SVG file(s) and ${result.counts.catalogEntries} catalog entry(ies).`);
  process.exit(1);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
