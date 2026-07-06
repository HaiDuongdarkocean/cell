// formatDetector — hybrid magic+ext+zip sniff → ImportFormat (ADR-023, spec F8).
//
// Detection order:
// 1. Magic bytes: gzip → check inner (sqlite .db.gz), zip → sniff content
// 2. Zip content sniff: index.json present → yomitan; .txt inside → txt;
//    Cambridge JSON array with {term, definition} → cambridge-json
// 3. Extension fallback
// 4. JSON content sniff: array of strings → json-array; array of {term} → cambridge-json

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
      const paths = Object.keys(files);
      // Yomitan: has index.json + (term_bank OR term_meta_bank)
      // term_bank = dictionary, term_meta_bank = frequency — both return 'yomitan'
      // (strategy decides which to parse based on resourceType)
      if (
        paths.some((p) => p.endsWith('index.json')) &&
        (paths.some((p) => p.includes('term_bank')) || paths.some((p) => p.includes('term_meta_bank')))
      ) {
        return 'yomitan';
      }
      // Cambridge JSON inside zip: single .json with array of {term, definition}
      const jsonFile = paths.find((p) => p.endsWith('.json'));
      if (jsonFile) {
        const content = decodeText(files[jsonFile]!);
        if (looksLikeCambridgeJson(content)) return 'cambridge-json';
        if (looksLikeJsonArray(content)) return 'json-array';
      }
      // TXT inside zip
      if (paths.some((p) => p.endsWith('.txt'))) return 'txt';
    } catch {
      // corrupt zip — fall through to extension
    }
    const fallback = detectByExtension(name);
    if (fallback) return fallback;
    return 'yomitan'; // zip default
  }

  // 3. SQLite (raw .db, not gzipped)
  if (isSqlite(head)) return 'sqlite';

  // 4. JSON content sniff
  const ext = getExtension(name);
  if (ext === 'json' || ext === 'txt') {
    const text = decodeText(head.slice(0, 4096)).trim();
    if (ext === 'json' || text.startsWith('[') || text.startsWith('{')) {
      if (looksLikeCambridgeJson(text)) return 'cambridge-json';
      if (looksLikeJsonArray(text)) return 'json-array';
    }
    if (ext === 'txt') return 'txt';
  }

  // 5. Extension fallback
  const fallback = detectByExtension(name);
  if (fallback) return fallback;

  throw new Error(`Could not detect format for file "${name}".`);
}

/** Heuristic: JSON array of strings → json-array (frequency list). */
function looksLikeJsonArray(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[')) return false;
  try {
    const parsed = JSON.parse(trimmed.slice(0, 10000)); // sample first 10K chars
    if (!Array.isArray(parsed)) return false;
    if (parsed.length === 0) return true; // empty array → assume json-array
    return typeof parsed[0] === 'string';
  } catch {
    return false;
  }
}

/** Heuristic: JSON array of {term, definition} → cambridge-json (dictionary). */
function looksLikeCambridgeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[')) return false;
  try {
    const parsed = JSON.parse(trimmed.slice(0, 10000));
    if (!Array.isArray(parsed)) return false;
    if (parsed.length === 0) return false;
    const first = parsed[0];
    return typeof first === 'object' && first !== null && 'term' in first && 'definition' in first;
  } catch {
    return false;
  }
}
