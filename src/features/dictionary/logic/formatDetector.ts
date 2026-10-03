// formatDetector — hybrid magic+ext+zip sniff → ImportFormat (ADR-023, spec F8).
//
// Detection order:
// 1. Magic bytes: gzip → check inner (sqlite .db.gz), zip → sniff content
// 2. Zip content sniff: index.json + *_bank_*.json → term-bank; .txt inside → txt;
//    JSON array with {term, definition} → json-entries
// 3. Extension fallback
// 4. JSON content sniff: array of strings → json-array; array of {term} → json-entries;
//    {index, list} object → wordlist-json

import type { ImportFormat } from '@/entities/dictionary';
import {
  isGzip,
  isZip,
  isSqlite,
  gunzipFile,
  unzipAll,
  decodeText,
  getExtension,
  stripExtension,
  detectByExtension,
  looksLikePlainText,
} from './fileDetector';

/** Detect format from file name + first 1MB bytes. */
export async function detectFormat(name: string, head: Uint8Array): Promise<ImportFormat> {
  // 1. gzip → gunzip, check inner
  if (isGzip(head)) {
    try {
      const inner = gunzipFile(head);
      if (isSqlite(inner)) return 'sqlite';
      // gzip-wrapped txt or json — check extension
      const innerExt = getExtension(stripExtension(name));
      if (innerExt === 'db') return 'sqlite';
      if (innerExt === 'txt') return 'txt';
      if (innerExt === 'json') return 'json-array';
    } catch {
      // corrupt gzip — fall through to extension
    }
    const fallback = detectByExtension(name);
    if (fallback) return fallback;
  }

  // 2. zip → sniff content
  if (isZip(head)) {
    try {
      const files = unzipAll(head);
      const sniffed = sniffZipFormat(files);
      if (sniffed) return sniffed;
    } catch {
      // corrupt or truncated zip (>1MB head) — fall through to extension;
      // importFile re-sniffs on full bytes before running the strategy.
    }
    const fallback = detectByExtension(name);
    if (fallback) return fallback;
    return 'term-bank'; // zip default
  }

  // 3. SQLite (raw .db, not gzipped)
  if (isSqlite(head)) return 'sqlite';

  // 4. JSON content sniff
  const ext = getExtension(name);
  if (ext === 'json' || ext === 'txt') {
    const text = decodeText(head.slice(0, 4096)).trim();
    if (ext === 'json' || text.startsWith('[') || text.startsWith('{')) {
      if (looksLikeWordlistJson(text)) return 'wordlist-json';
      if (looksLikeJsonFrequency(text)) return 'json-frequency';
      if (looksLikeJsonEntries(text)) return 'json-entries';
      if (looksLikeJsonArray(text)) return 'json-array';
    }
    if (ext === 'txt') return 'txt';
  }

  // 5. Extension fallback
  const fallback = detectByExtension(name);
  if (fallback) return fallback;

  throw new Error(`Could not detect format for file "${name}".`);
}

/** Format of an unzipped entry set — shared by head sniff + full-data re-sniff. */
export function sniffZipFormat(files: Record<string, Uint8Array>): ImportFormat | null {
  const paths = Object.keys(files);
  // Banked zip: index.json + (term_bank OR term_meta_bank)
  if (
    paths.some((p) => p.endsWith('index.json')) &&
    (paths.some((p) => p.includes('term_bank')) || paths.some((p) => p.includes('term_meta_bank')))
  ) {
    return 'term-bank';
  }
  const jsonFile = paths.find((p) => p.endsWith('.json'));
  if (jsonFile) {
    const text = decodeText(files[jsonFile]!.slice(0, 8192));
    if (looksLikeJsonEntries(text)) return 'json-entries';
    if (looksLikeJsonFrequency(text)) return 'json-frequency';
    if (looksLikeJsonArray(text)) return 'json-array';
    if (looksLikeWordlistJson(text)) return 'wordlist-json';
    if (looksLikePlainText(files[jsonFile]!)) return 'txt';
  }
  if (paths.some((p) => p.endsWith('.txt'))) return 'txt';
  return null;
}

/** Heuristic: JSON array of strings → json-array (frequency list). */
function looksLikeJsonArray(text: string): boolean {
  return /^\s*\[\s*"/.test(text);
}

/** Heuristic: JSON array of {term, definition, ...} objects → json-entries. */
function looksLikeJsonEntries(text: string): boolean {
  if (!/^\s*\[\s*\{/.test(text)) return false;
  const head = text.slice(0, 4096);
  return head.includes('"term"') && head.includes('"definition"');
}

/** Heuristic: JSON array of {term, pos?, rank|frequency} objects (no
 *  definition field) → json-frequency (pos-dictionary-variants). */
function looksLikeJsonFrequency(text: string): boolean {
  if (!/^\s*\[\s*\{/.test(text)) return false;
  const head = text.slice(0, 8192);
  if (head.includes('"definition"')) return false;
  return head.includes('"term"') && (head.includes('"rank"') || head.includes('"frequency"'));
}

/** Heuristic: JSON object {index: {...}, list: [[term, reading, [tags]]]} → wordlist-json. */
function looksLikeWordlistJson(text: string): boolean {
  if (!/^\s*\{/.test(text)) return false;
  const head = text.slice(0, 4096);
  return head.includes('"list"') && head.includes('"index"');
}
