#!/usr/bin/env node
// tihoka-convert-frequency — standalone converter: pos-aware frequency
// containers → json-frequency (.json) the app imports unchanged.
//
// Pipeline: input .mdx → js-mdict record stream → per-pos block parse
// (pos/rank/total/5-genre) → canonical pos normalization via
// src/shared/lib/posNormalize (through jiti — the SAME map the import
// strategy uses) → one {term,pos,rank,total,genres} object per (term,pos).
//
// Usage:
//   node scripts/tihoka-convert-frequency.mjs <input.mdx> [-o out.json] [--limit N] [--only a,b] [--stats]

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const normWord = (w) => String(w ?? '').trim().normalize('NFC').toLowerCase();
const GENRES = ['spoken', 'fiction', 'magazine', 'newspaper', 'academic'];

function parseFreqBlocks(html) {
  const out = [];
  const blockRe = /<span class="pos">([^<]*)<\/span>\s*<span class="rank">([^<]*)<\/span>\s*<div class="total">([^<]*)<\/div>\s*<div class="table">([\s\S]*?)(?=<span class="pos">|<script|<\/div>\s*$|$)/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const genres = {};
    for (const g of GENRES) {
      const gm = m[4].match(new RegExp(`<div class="${g}"><div class="freq">(\\d+)</div>`));
      if (gm) genres[g] = Number(gm[1]);
    }
    out.push({ pos: m[1].trim(), rank: Number(m[2]), total: Number(m[3]), genres });
  }
  return out;
}

async function* readRecords(inputPath, only) {
  const mod = await import('js-mdict');
  const MDX = mod.MDX ?? mod.default?.MDX;
  if (!MDX) throw new Error('js-mdict not available — npm i -D js-mdict');
  const mdx = new MDX(inputPath, { passcode: undefined, resort: true, isStripKey: true, isCaseSensitive: false });
  for (const kw of mdx.keywordList) {
    const keyText = String(kw.keyText ?? '').replace(/^"|"$/g, '');
    if (!keyText) continue;
    if (only && !only.has(keyText.toLowerCase())) continue;
    const html = mdx.fetch_definition(kw)?.definition;
    if (!html) continue;
    yield { term: keyText, html };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('-'));
  const outIdx = args.indexOf('-o');
  const limitIdx = args.indexOf('--limit');
  const statsOnly = args.includes('--stats');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0
    ? new Set(args[onlyIdx + 1].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))
    : undefined;
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  if (!input) {
    console.error('usage: node scripts/tihoka-convert-frequency.mjs <input.mdx> [-o out.json] [--limit N] [--only a,b] [--stats]');
    process.exit(1);
  }
  if (!resolve(input).toLowerCase().endsWith('.mdx')) {
    console.error('json-frequency conversion supports .mdx input only');
    process.exit(1);
  }

  const jiti = createJiti(import.meta.url);
  const { normalizePos } = await jiti.import(
    pathToFileURL(join(ROOT, 'src/shared/lib/posNormalize.ts')).href,
  );

  const outPath = outIdx >= 0
    ? resolve(args[outIdx + 1])
    : join(dirname(resolve(input)), `${basename(input, extname(input))}.freq.json`);

  const stats = { terms: 0, rows: 0, skipped: 0, noBlocks: 0, dupes: 0, posSeen: new Map() };
  const out = [];
  const seen = new Set();
  for await (const rec of readRecords(resolve(input), only)) {
    if (stats.terms >= limit) break;
    const term = normWord(rec.term);
    if (!term) { stats.skipped++; continue; }
    const blocks = parseFreqBlocks(rec.html);
    stats.terms++;
    if (!blocks.length) { stats.noBlocks++; continue; }
    for (const b of blocks) {
      if (!Number.isFinite(b.rank) || b.rank < 0) { stats.skipped++; continue; }
      const pos = normalizePos(b.pos);
      const key = `${term}\x1f${pos}`;
      if (seen.has(key)) { stats.dupes++; continue; }
      seen.add(key);
      stats.posSeen.set(pos || '(none)', (stats.posSeen.get(pos || '(none)') ?? 0) + 1);
      out.push({
        term,
        ...(pos ? { pos } : {}),
        rank: b.rank,
        ...(Number.isFinite(b.total) ? { total: b.total } : {}),
        ...(Object.keys(b.genres).length ? { genres: b.genres } : {}),
      });
      stats.rows++;
    }
  }

  console.log(`terms: ${stats.terms} (skipped ${stats.skipped}, no-blocks ${stats.noBlocks}, dupes ${stats.dupes}) · rows: ${stats.rows}`);
  console.log('pos:', [...stats.posSeen.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}:${n}`).join(' '));

  if (!statsOnly) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(out));
    console.log(`wrote ${outPath}`);
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
