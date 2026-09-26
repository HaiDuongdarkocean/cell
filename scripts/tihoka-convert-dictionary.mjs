#!/usr/bin/env node
// tihoka-convert-dictionary — standalone converter: heterogeneous dictionary
// files → canonical json-entries (.json) the app imports unchanged.
//
// Pipeline: input file → container detection (magic bytes, never vendor
// names) → dict-adapters/* readers & markup adapters → canonical normalizer
// (src/features/dictionary/logic/normalize via jiti — the SAME pipeline the
// import strategies use) → json-entries output.
//
// Usage:
//   node scripts/tihoka-convert-dictionary.mjs <input> [-o out.json] [--limit N] [--only a,b] [--stats]
//
//   input    .json / .json.gz (entry-object array) · .zip (term-bank,
//            zip-of-json, or zip-of-mdx/mdd) · .mdx · .db / .db.gz (sqlite)
//   -o       output path (default: <input-stem>.normalized.json next to input)
//   --limit N     normalize only the first N entries
//   --only a,b    convert only these exact keys (spot checks)
//   --stats       print line/role/translation counts without writing output

import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { gunzipSync, unzipSync, strFromU8 } from 'fflate';
import { iterJsonEntries } from './dict-adapters/jsonEntries.mjs';
import { iterTermBank } from './dict-adapters/termBank.mjs';
import { iterSqlite } from './dict-adapters/sqlite.mjs';
import { iterMdx } from './dict-adapters/mdx.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const isGzip = (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
const isZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;
const isSqlite = (b) =>
  b.length > 16 && strFromU8(b.subarray(0, 15)) === 'SQLite format 3';
const normWord = (w) => String(w ?? '').trim().normalize('NFC').toLowerCase();

async function* readRawEntries(inputPath, only) {
  let bytes = new Uint8Array(readFileSync(inputPath));
  if (isGzip(bytes)) bytes = gunzipSync(bytes);

  if (isZip(bytes)) {
    const files = unzipSync(bytes);
    const paths = Object.keys(files);
    if (paths.some((p) => p.endsWith('index.json')) && paths.some((p) => p.includes('term_bank'))) {
      yield* iterTermBank(files);
      return;
    }
    const mdxPath = paths.find((p) => p.toLowerCase().endsWith('.mdx'));
    if (mdxPath) {
      const tmpDir = mkdtempSync(join(tmpdir(), 'normdict-'));
      const tmpMdx = join(tmpDir, 'payload.mdx');
      const mddPath = paths.find((p) => p.toLowerCase().endsWith('.mdd'));
      try {
        writeFileSync(tmpMdx, files[mdxPath]);
        if (mddPath) writeFileSync(join(tmpDir, 'payload.mdd'), files[mddPath]);
        yield* iterMdx(tmpMdx, only);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
      return;
    }
    const jsonPath = paths.find((p) => p.endsWith('.json'));
    if (!jsonPath) throw new Error('zip contains no supported .json/.mdx dictionary payload');
    yield* iterJsonEntries(strFromU8(files[jsonPath]));
    return;
  }

  if (inputPath.toLowerCase().endsWith('.mdx')) {
    yield* iterMdx(inputPath, only);
    return;
  }

  if (isSqlite(bytes)) {
    yield* iterSqlite(bytes);
    return;
  }

  const text = strFromU8(bytes);
  const head = text.trimStart()[0];
  if (head === '[') {
    yield* iterJsonEntries(text);
    return;
  }
  throw new Error('unrecognized input: not gzip/zip/sqlite magic and not a JSON array');
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
    console.error('usage: node scripts/tihoka-convert-dictionary.mjs <input> [-o out.json] [--limit N] [--only a,b] [--stats]');
    process.exit(1);
  }

  const jiti = createJiti(import.meta.url);
  const { toCanonicalDefinition } = await jiti.import(
    pathToFileURL(join(ROOT, 'src/features/dictionary/logic/normalize/canonical.ts')).href,
  );

  const outPath = outIdx >= 0
    ? resolve(args[outIdx + 1])
    : join(dirname(resolve(input)), `${basename(input, extname(input)).replace(/\.(json|db)$/, '')}.normalized.json`);

  const stats = { entries: 0, skipped: 0, senses: 0, gloss: 0, example: 0, note: 0, translations: 0, redirects: 0 };
  const out = [];
  const outByTerm = new Map();
  const glossKey = (s) => s.lines?.find((l) => l.role === 'gloss')?.text?.toLowerCase() ?? '';
  for await (const raw of readRawEntries(resolve(input), only)) {
    if (stats.entries >= limit) break;
    const term = normWord(raw.term);
    if (!term) { stats.skipped++; continue; }
    const c = toCanonicalDefinition(raw);
    stats.senses += c.senses.length;
    for (const s of c.senses) {
      for (const l of s.lines) {
        stats[l.role] = (stats[l.role] ?? 0) + 1;
        if (l.translation) stats.translations++;
        if (l.text.startsWith('→ ')) stats.redirects++;
      }
    }
    const existing = raw.spawned ? outByTerm.get(term) : undefined;
    if (existing) {
      for (const s of c.senses) {
        const g = glossKey(s);
        if (g && existing.senses.some((x) => glossKey(x) === g)) continue;
        existing.senses.push(s);
      }
      continue;
    }
    stats.entries++;
    const entry = {
      term,
      reading: raw.reading ? normWord(raw.reading) : term,
      altterm: raw.altterm ? normWord(raw.altterm) : '',
      pronunciation: (raw.pronunciation ?? '').trim().normalize('NFC'),
      definition: c.definition,
      senses: c.senses,
      pos: c.pos,
      examples: c.examples,
      audio: (raw.audio ?? '').trim(),
      ...(raw.related?.length ? { related: raw.related } : {}),
      ...(raw.inflections?.length ? { inflections: raw.inflections } : {}),
      ...(raw.frequencyStars ? { frequencyStars: raw.frequencyStars } : {}),
      ...(raw.anagrams?.length ? { anagrams: raw.anagrams } : {}),
      ...(raw.level ? { level: raw.level } : {}),
      ...(raw.etymology ? { etymology: raw.etymology } : {}),
      ...(raw.wordFamily ? { wordFamily: raw.wordFamily } : {}),
      ...(raw.wordNet ? { wordNet: raw.wordNet } : {}),
      ...(raw.derivedTerms?.length ? { derivedTerms: raw.derivedTerms } : {}),
    };
    out.push(entry);
    if (!outByTerm.has(term)) outByTerm.set(term, entry);
  }

  console.log(`entries: ${stats.entries} (skipped ${stats.skipped}) · senses: ${stats.senses} · ` +
    `lines: gloss ${stats.gloss} / example ${stats.example} / note ${stats.note} · ` +
    `translations: ${stats.translations} · redirects: ${stats.redirects}`);

  if (!statsOnly) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(out));
    console.log(`wrote ${outPath}`);
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
