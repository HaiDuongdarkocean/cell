#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.DEVIN_PROJECT_DIR || process.cwd();
const BRIEF_ONLY = process.argv.includes('--brief-only');
const slug = process.argv.slice(2).find((a) => !a.startsWith('--'));

const briefRel = `docs/intent/${slug}-design-brief.md`;
const mappingRel = `docs/intent/${slug}-component-mapping.md`;

function fail(msgs) {
  for (const m of msgs) process.stderr.write(`${m}\n`);
  process.stdout.write('VERDICT: FAIL\n');
  process.exit(1);
}

function flatten(obj, prefix = '', acc = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, p, acc);
    else acc[p] = v;
  }
  return acc;
}

function tokenNames() {
  const p = join(ROOT, 'src/shared/styles/tokens.json');
  if (!existsSync(p)) fail([`missing tokens source ${p}`]);
  const flat = flatten(JSON.parse(readFileSync(p, 'utf8')));
  const paths = new Set(Object.keys(flat));
  const leafNames = new Set();
  for (const k of paths) {
    const segs = k.split('.');
    for (let n = 1; n <= Math.min(3, segs.length); n += 1) {
      leafNames.add(segs.slice(-n).join('-'));
    }
  }
  return { paths, leafNames };
}

function componentNames() {
  const dir = join(ROOT, 'src/shared/ui');
  if (!existsSync(dir)) fail([`missing shared ui dir ${dir}`]);
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.showcase.tsx') && !f.endsWith('.test.tsx'))
      .map((f) => f.slice(0, -4)),
  );
}

function iconNames() {
  const p = join(ROOT, 'src/shared/icons/index.ts');
  if (!existsSync(p)) fail([`missing icon catalog ${p}`]);
  const text = readFileSync(p, 'utf8');
  const body = text.slice(text.indexOf('ICON_CATALOG = {'), text.indexOf('};', text.indexOf('ICON_CATALOG = {')));
  return new Set([...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
}

function extractTokens(text) {
  const names = new Set();
  for (const m of text.matchAll(/`?--([a-z0-9-]+)`?/gi)) names.add(m[1]);
  for (const m of text.matchAll(/`((?:core|derived|static|component|composite|presets)\.[a-zA-Z0-9_.-]+)`/g)) {
    names.add(m[1]);
  }
  return names;
}

function componentRefs(text) {
  const names = new Set();
  for (const m of text.matchAll(/components?\s*:\s*([^\n|]+)/gi)) {
    for (const n of m[1].matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)) names.add(n[1]);
  }
  const lines = text.split('\n');
  const headerIdx = lines.findIndex((l) => /^\s*\|/.test(l) && /component/i.test(l));
  if (headerIdx >= 0) {
    const cols = lines[headerIdx].split('|').map((c) => c.trim().toLowerCase());
    const colIdx = cols.findIndex((c) => /component/.test(c));
    if (colIdx > 0) {
      for (let i = headerIdx + 2; i < lines.length && /^\s*\|/.test(lines[i]); i += 1) {
        const cells = lines[i].split('|').map((c) => c.trim().replace(/`/g, ''));
        for (const n of (cells[colIdx] || '').matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)) names.add(n[1]);
      }
    }
  }
  return names;
}

function iconRefs(text) {
  const names = new Set();
  for (const m of text.matchAll(/\bicon\s*:\s*`?([a-zA-Z][a-zA-Z0-9-]*)`?/gi)) names.add(m[1]);
  return names;
}

if (!slug) {
  process.stderr.write('usage: check-design-brief.mjs <slug> [--brief-only]\n');
  process.exit(1);
}

const missing = [];
const briefPath = join(ROOT, briefRel);
const mappingPath = join(ROOT, mappingRel);
if (!existsSync(briefPath)) missing.push(`missing design brief ${briefRel}`);
if (!BRIEF_ONLY && !existsSync(mappingPath)) missing.push(`missing component mapping ${mappingRel}`);
if (missing.length) fail(missing);

const tokens = tokenNames();
const components = componentNames();
const icons = iconNames();

const sources = [briefPath];
if (!BRIEF_ONLY && existsSync(mappingPath)) sources.push(mappingPath);

let checked = { tokens: 0, components: 0, icons: 0 };
for (const src of sources) {
  const text = readFileSync(src, 'utf8');
  const rel = src.slice(ROOT.length + 1).replace(/\\/g, '/');
  for (const t of extractTokens(text)) {
    checked.tokens += 1;
    const ok = t.includes('.') ? tokens.paths.has(t) : tokens.leafNames.has(t);
    if (!ok) missing.push(`${rel}: token '${t}' not found in tokens.json`);
  }
  for (const c of componentRefs(text)) {
    checked.components += 1;
    if (!components.has(c)) missing.push(`${rel}: component '${c}' not found in src/shared/ui/`);
  }
  for (const i of iconRefs(text)) {
    checked.icons += 1;
    if (!icons.has(i)) missing.push(`${rel}: icon '${i}' not found in ICON_CATALOG`);
  }
}

if (missing.length) fail(missing);
process.stdout.write(
  `design brief ok — ${checked.tokens} tokens, ${checked.components} components, ${checked.icons} icons\nVERDICT: PASS\n`,
);
