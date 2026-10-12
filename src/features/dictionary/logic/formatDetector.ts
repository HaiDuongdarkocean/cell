// formatDetector — hybrid magic+ext+zip sniff → ImportFormat (ADR-023, spec F8).
//
// Detection order:
// 1. Magic bytes: gzip → check inner (sqlite .db.gz), zip → sniff content
// 2. Zip content sniff: index.json + *_bank_*.json → term-bank; .txt inside → txt;
//    JSON array with {term, definition} → json-entries
// 3. Extension fallback
// 4. JSON content sniff: array of strings → json-array; array of {term} → json-entries;
//    {index, list} object → wordlist-json

import type { DictionaryComponent, ImportFormat } from '@/entities/dictionary';
import {
  isGzip,
  isZip,
  isSqlite,
  gunzipFile,
  unzipAll,
  isImportZipEntry,
  decodeText,
  getExtension,
  stripExtension,
  detectByExtension,
  looksLikePlainText,
} from './fileDetector';
import { ParseError } from './importErrors';

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
      const files = unzipAll(head, isImportZipEntry);
      const sniffed = sniffZipFormat(files);
      if (sniffed) return sniffed;
    } catch (e) {
      if (e instanceof ParseError) throw e;
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
      const kind = detectJsonKind(text);
      if (kind) return kind;
    }
    if (ext === 'txt') return 'txt';
  }

  // 5. Extension fallback
  const fallback = detectByExtension(name);
  if (fallback) return fallback;

  throw new Error(`Could not detect format for file "${name}".`);
}

/** Components a file can emit — advisory detection for the import badge and
 *  the multi-component picker. 'definitions' is the token for dictionary
 *  content, 'frequency' for rank data. The strategy stays authoritative:
 *  it emits every content family actually present. */
export async function detectComponents(name: string, head: Uint8Array): Promise<readonly DictionaryComponent[]> {
  const format = await detectFormat(name, head);
  return componentsForFormat(format, head);
}

/** Components implied by a detected format (+ content sniff for zip/sqlite). */
export function componentsForFormat(format: ImportFormat, bytes: Uint8Array): readonly DictionaryComponent[] {
  switch (format) {
    case 'txt':
    case 'json-array':
    case 'json-frequency':
      return ['frequency'];
    case 'json-entries':
    case 'wordlist-json':
      return ['definitions'];
    case 'term-bank': {
      let files: Record<string, Uint8Array>;
      try {
        files = unzipAll(isGzip(bytes) ? gunzipFile(bytes) : bytes, isImportZipEntry);
      } catch {
        return ['definitions'];
      }
      return sniffZipComponents(files) ?? ['definitions'];
    }
    case 'sqlite':
      return sniffSqliteComponents(bytes);
    default:
      return ['definitions'];
  }
}

/** Components for a banked zip — bank filenames are authoritative. */
export function sniffZipComponents(files: Record<string, Uint8Array>): readonly DictionaryComponent[] | null {
  const paths = Object.keys(files);
  const hasDictBanks = paths.some((p) => p.includes('term_bank'));
  const hasFreqBanks = paths.some((p) => p.includes('term_meta_bank'));
  if (!hasDictBanks && !hasFreqBanks) return null;
  return hasDictBanks ? (hasFreqBanks ? ['definitions', 'frequency'] : ['definitions']) : ['frequency'];
}

/** Components for a sqlite file — table names in sqlite_master are ASCII and
 *  sit near the head, so a byte-level name sniff suffices for the badge. */
export function sniffSqliteComponents(bytes: Uint8Array): readonly DictionaryComponent[] {
  const text = decodeText(isGzip(bytes) ? safeGunzip(bytes) : bytes);
  const hasDict = text.includes('langResourceEntry');
  const hasFreq = text.includes('langFrequencyEntry') || /table\s+"?entries"?\s*\(/i.test(text);
  const out: DictionaryComponent[] = [];
  if (hasDict) out.push('definitions');
  if (hasFreq) out.push('frequency');
  return out.length > 0 ? out : ['definitions'];
}

function safeGunzip(bytes: Uint8Array): Uint8Array {
  try {
    return gunzipFile(bytes);
  } catch {
    return bytes;
  }
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
  const json = selectZipDataJson(files);
  const txtPaths = paths.filter((p) => p.endsWith('.txt'));
  if (json) {
    if (txtPaths.length > 0) {
      throw new ParseError('Zip contains both a JSON data file and a word list — import them one at a time.');
    }
    return json.format;
  }
  if (txtPaths.length > 1) {
    throw new ParseError(`Zip contains ${txtPaths.length} word lists — import them one at a time.`);
  }
  if (txtPaths.length === 1) return 'txt';
  return null;
}

export interface ZipDataEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly format: ImportFormat;
}

const isDataJsonPath = (p: string): boolean =>
  p.endsWith('.json') && !p.endsWith('index.json') && !p.includes('_bank_');

/** The single data-shaped .json inside a zip — verified by content, not by
 *  position. More than one = ambiguous container (a strategy can only import
 *  one) → ParseError rather than silently dropping files. Returns null when
 *  no .json sniffs as importable data. */
export function selectZipDataJson(files: Record<string, Uint8Array>): ZipDataEntry | null {
  const matched: ZipDataEntry[] = [];
  for (const path of Object.keys(files)) {
    if (!isDataJsonPath(path)) continue;
    const bytes = files[path]!;
    const format =
      detectJsonKind(decodeText(bytes.slice(0, 8192))) ??
      (looksLikePlainText(bytes) ? 'txt' : null);
    if (format) matched.push({ path, bytes, format });
  }
  if (matched.length > 1) {
    throw new ParseError(`Zip contains ${matched.length} data files — import them one at a time.`);
  }
  return matched[0] ?? null;
}

/** JSON shape → format. The shapes are mutually exclusive by construction. */
export function detectJsonKind(text: string): ImportFormat | null {
  if (looksLikeJsonEntries(text)) return 'json-entries';
  if (looksLikeJsonFrequency(text)) return 'json-frequency';
  if (looksLikeJsonArray(text)) return 'json-array';
  if (looksLikeWordlistJson(text)) return 'wordlist-json';
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
