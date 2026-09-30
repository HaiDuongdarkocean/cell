import { isSqlite, isZip, unzipAll, decodeText } from '@/features/dictionary/logic/fileDetector';
import { decodeMemoryState } from '../logic/stateConvert';
import type {
  MediaResolver,
  NormalizedAnkiCard,
  NormalizedAnkiData,
  NormalizedAnkiDeck,
  NormalizedAnkiNote,
  NormalizedAnkiNotetype,
  NormalizedAnkiRevlog,
} from '../model/normalized';
import type { SqlJsDatabase } from '../lib/sqlJs';
import { loadSqlJs } from '../lib/sqlJs';

export class ApkgError extends Error {
  readonly code: 'NOT_ZIP' | 'STUB_ANKI2' | 'NO_COLLECTION' | 'DB_OPEN' | 'ZSTD';
  constructor(code: ApkgError['code'], message: string) {
    super(message);
    this.name = 'ApkgError';
    this.code = code;
  }
}

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstd(data: Uint8Array): boolean {
  return data.length > 4 && ZSTD_MAGIC.every((b, i) => data[i] === b);
}

async function decompressZstd(data: Uint8Array): Promise<Uint8Array> {
  try {
    const { decompress } = await import('fzstd');
    return decompress(data);
  } catch (e) {
    throw new ApkgError('ZSTD', `Không giải nén được collection.anki21b: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', opus: 'audio/opus', webm: 'audio/webm', flac: 'audio/flac',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
};

function mimeOf(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/** Extract memory_state (field 4, embedded message) from a cards.data protobuf blob. */
export function extractMemoryStateFromCardData(blob: Uint8Array): { stability: number; difficulty: number } | null {
  let i = 0;
  while (i < blob.length) {
    const tag = blob[i++]!;
    const wire = tag & 7;
    if (wire === 2) {
      let len = 0, shift = 0;
      while (i < blob.length) { const b = blob[i++]!; len |= (b & 0x7f) << shift; shift += 7; if (b < 0x80) break; }
      const inner = blob.subarray(i, i + len);
      const decoded = decodeMemoryState(inner);
      if (decoded && decoded.stability > 0 && decoded.difficulty > 0 && decoded.difficulty <= 10) return decoded;
      i += len;
    } else if (wire === 0) {
      while (i < blob.length && blob[i++]! >= 0x80) { /* varint */ }
    } else if (wire === 5) { i += 4; } else if (wire === 1) { i += 8; } else { return null; }
  }
  return null;
}

function tableSet(db: SqlJsDatabase): Set<string> {
  const rows = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  return new Set((rows[0]?.values ?? []).map((r) => String(r[0])));
}

function colObjects(db: SqlJsDatabase): { crt: number; decks: Record<string, unknown>; models: Record<string, unknown>; deckconf: Record<string, unknown> } {
  const hasAll = (cols: string[], need: string[]) => need.every((c) => cols.includes(c));
  const res = db.exec('SELECT * FROM col');
  const row = res[0];
  if (!row || row.values.length === 0) return { crt: 0, decks: {}, models: {}, deckconf: {} };
  const cols = row.columns;
  const r = row.values[0]!;
  const get = (name: string) => (hasAll(cols, [name]) ? r[cols.indexOf(name)] : null);
  return {
    crt: Number(get('crt') ?? 0),
    decks: JSON.parse(String(get('decks') ?? '{}')) as Record<string, unknown>,
    models: JSON.parse(String(get('models') ?? '{}')) as Record<string, unknown>,
    deckconf: JSON.parse(String(get('dconf') ?? get('deckconf') ?? '{}')) as Record<string, unknown>,
  };
}

interface DeckConfEntry { desiredRetention?: number }

function readDecks(db: SqlJsDatabase, tables: Set<string>, colJson: ReturnType<typeof colObjects>): NormalizedAnkiDeck[] {
  const drByConf = new Map<string, number>();
  for (const [confId, conf] of Object.entries(colJson.deckconf)) {
    const dr = (conf as DeckConfEntry)?.desiredRetention;
    if (typeof dr === 'number') drByConf.set(confId, dr);
  }
  const confByDeck = new Map<string, string>();
  for (const [id, d] of Object.entries(colJson.decks)) {
    const conf = (d as { conf?: number })?.conf;
    if (conf !== undefined) confByDeck.set(id, String(conf));
  }

  if (tables.has('decks')) {
    const rows = db.exec('SELECT id, name, kind FROM decks');
    return (rows[0]?.values ?? []).map((r) => ({
      id: String(r[0]),
      name: String(r[1]),
      filtered: Number(r[2]) === 1,
      desiredRetention: drByConf.get(confByDeck.get(String(r[0])) ?? '') ?? undefined,
    }));
  }
  return Object.entries(colJson.decks).map(([id, d]) => {
    const deck = d as { name?: string; dyn?: number };
    return {
      id,
      name: deck.name ?? id,
      filtered: deck.dyn === 1,
      desiredRetention: drByConf.get(confByDeck.get(id) ?? '') ?? undefined,
    };
  });
}

function readNotetypes(db: SqlJsDatabase, tables: Set<string>, colJson: ReturnType<typeof colObjects>): NormalizedAnkiNotetype[] {
  if (tables.has('notetypes') && tables.has('fields')) {
    const ntRows = db.exec('SELECT id, name, kind FROM notetypes');
    const fieldRows = db.exec('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord');
    const fieldsByNt = new Map<string, { name: string; ord: number }[]>();
    for (const r of fieldRows[0]?.values ?? []) {
      const ntid = String(r[0]);
      const list = fieldsByNt.get(ntid) ?? [];
      list.push({ ord: Number(r[1]), name: String(r[2]) });
      fieldsByNt.set(ntid, list);
    }
    return (ntRows[0]?.values ?? []).map((r) => ({
      id: String(r[0]),
      name: String(r[1]),
      isCloze: Number(r[2]) === 1,
      fields: fieldsByNt.get(String(r[0])) ?? [],
    }));
  }
  return Object.entries(colJson.models).map(([id, m]) => {
    const model = m as { name?: string; type?: number; flds?: { name: string; ord: number }[] };
    return {
      id,
      name: model.name ?? id,
      isCloze: model.type === 1,
      fields: (model.flds ?? []).map((f) => ({ name: f.name, ord: f.ord })),
    };
  });
}

function readNotes(db: SqlJsDatabase, _tables: Set<string>): NormalizedAnkiNote[] {
  const cols = db.exec('PRAGMA table_info(notes)');
  const names = new Set((cols[0]?.values ?? []).map((r) => String(r[1])));
  const idCol = names.has('ntid') ? 'ntid' : 'mid';
  const rows = db.exec(`SELECT id, ${idCol}, flds, tags FROM notes`);
  return (rows[0]?.values ?? []).map((r) => ({
    id: Number(r[0]),
    modelId: String(r[1]),
    fields: String(r[2] ?? '').split('\x1f'),
    tags: String(r[3] ?? '').split(' ').filter(Boolean),
  }));
}

function readCards(db: SqlJsDatabase): NormalizedAnkiCard[] {
  const rows = db.exec('SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses, left, odid, data FROM cards');
  return (rows[0]?.values ?? []).map((r) => {
    const raw = r[13];
    let memoryState: NormalizedAnkiCard['memoryState'];
    if (raw instanceof Uint8Array && raw.length > 0) {
      memoryState = extractMemoryStateFromCardData(raw) ?? undefined;
    }
    return {
      id: Number(r[0]),
      noteId: Number(r[1]),
      deckId: String(r[2]),
      ord: Number(r[3]),
      type: Number(r[4]),
      queue: Number(r[5]),
      due: Number(r[6]),
      ivl: Number(r[7]),
      factor: Number(r[8]),
      reps: Number(r[9]),
      lapses: Number(r[10]),
      left: Number(r[11]),
      odid: Number(r[12]),
      memoryState,
    };
  });
}

function readRevlog(db: SqlJsDatabase): NormalizedAnkiRevlog[] {
  const rows = db.exec('SELECT id, cid, ease, ivl, time FROM revlog');
  return (rows[0]?.values ?? []).map((r) => ({
    id: Number(r[0]),
    cardId: Number(r[1]),
    ease: Number(r[2]),
    ivl: Number(r[3]),
    time: Number(r[4]),
  }));
}

/** Parse a `.apkg` buffer into NormalizedAnkiData. Fully client-side. */
export async function parseApkg(zipBytes: Uint8Array): Promise<NormalizedAnkiData> {
  if (!isZip(zipBytes)) throw new ApkgError('NOT_ZIP', 'File không phải .apkg (zip).');
  const entries = unzipAll(zipBytes);

  let collectionBytes: Uint8Array | null = null;
  if (entries['collection.anki21b']) {
    collectionBytes = isZstd(entries['collection.anki21b']!)
      ? await decompressZstd(entries['collection.anki21b']!)
      : entries['collection.anki21b']!;
  } else if (entries['collection.anki21']) {
    collectionBytes = entries['collection.anki21']!;
  } else if (entries['collection.anki2']) {
    collectionBytes = entries['collection.anki2']!;
  }
  if (!collectionBytes) throw new ApkgError('NO_COLLECTION', 'Không tìm thấy collection trong .apkg.');
  if (!isSqlite(collectionBytes)) {
    const head = decodeText(collectionBytes.slice(0, 200));
    if (/newer version|not in.*format/i.test(head)) {
      throw new ApkgError('STUB_ANKI2', 'File export không chứa dữ liệu — hãy export lại với tùy chọn hỗ trợ client mới.');
    }
    throw new ApkgError('DB_OPEN', 'Collection không phải SQLite hợp lệ.');
  }

  const SQL = await loadSqlJs();
  let db: SqlJsDatabase;
  try {
    db = new SQL.Database(collectionBytes);
  } catch (e) {
    throw new ApkgError('DB_OPEN', `Mở collection thất bại: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const tables = tableSet(db);
    const colJson = colObjects(db);
    const decks = readDecks(db, tables, colJson);
    const notetypes = readNotetypes(db, tables, colJson);
    const notes = readNotes(db, tables);
    const cards = readCards(db);
    const revlog = readRevlog(db);

    const mediaMap = new Map<string, string>();
    if (entries['media']) {
      const parsed = JSON.parse(decodeText(entries['media']!)) as Record<string, string>;
      for (const [idx, name] of Object.entries(parsed)) mediaMap.set(name, idx);
    }
    const resolve: MediaResolver = async (filename) => {
      const idx = mediaMap.get(filename) ?? (entries[filename] ? filename : null);
      const bytes = idx !== null ? entries[idx] : undefined;
      if (!bytes) return null;
      return { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, mimeType: mimeOf(filename) };
    };

    const hasScheduling = cards.some((c) => c.ivl > 0 || c.reps > 0) || revlog.length > 0;

    return {
      source: 'apkg',
      fidelity: 'full',
      hasScheduling,
      crtMs: colJson.crt > 0 ? colJson.crt * 1000 : null,
      decks,
      notetypes,
      notes,
      cards,
      revlog,
      media: {
        names: [...mediaMap.keys()],
        resolve,
        size: (filename) => {
          const idx = mediaMap.get(filename) ?? (entries[filename] ? filename : null);
          return idx !== null ? entries[idx]?.byteLength ?? null : null;
        },
      },
    };
  } finally {
    db.close();
  }
}
