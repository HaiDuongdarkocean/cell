import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { parseApkg, extractMemoryStateFromCardData } from './apkgAdapter';

jest.mock('sql.js', () => {
  const real = jest.requireActual('sql.js/dist/sql-wasm.js');
  return {
    __esModule: true,
    default: (config?: { locateFile?: (f: string) => string }) =>
      real({
        ...(config ?? {}),
        locateFile: (f: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
      }),
  };
});

async function buildCollectionSql(): Promise<Uint8Array> {
  const initSqlJs = jest.requireActual('sql.js/dist/sql-wasm.js');
  const SQL = await initSqlJs({ locateFile: (f: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f) });
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE col (id integer, crt integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
    INSERT INTO col VALUES (1, 1700000000, 0, 11, 0, 0, 0, '{}',
      '{"111": {"name": "Basic", "type": 0, "flds": [{"name": "Front", "ord": 0}, {"name": "Back", "ord": 1}]},
        "222": {"name": "Cloze", "type": 1, "flds": [{"name": "Text", "ord": 0}]}}',
      '{"1": {"name": "Default", "dyn": 0, "conf": 1}, "2": {"name": "Lang::JP::Core", "dyn": 0, "conf": 1}, "9": {"name": "Filtered", "dyn": 1}}',
      '{"1": {"desiredRetention": 0.9}}', '{}');
    CREATE TABLE notes (id integer, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text);
    INSERT INTO notes VALUES (100, 'g1', 111, 0, 0, ' verb ', '捨てる\x1fto throw away [sound:w.mp3]', '', 0, 0, '');
    INSERT INTO notes VALUES (101, 'g2', 222, 0, 0, '', 'cloze text', '', 0, 0, '');
    CREATE TABLE cards (id integer, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data blob);
    INSERT INTO cards VALUES (1000, 100, 2, 0, 0, 0, 2, 2, 400, 30, 2500, 12, 1, 0, 0, 0, 0, '');
    INSERT INTO cards VALUES (1001, 100, 2, 1, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, '');
    INSERT INTO cards VALUES (1002, 100, 9, 0, 0, 0, 2, 2, 401, 30, 2500, 3, 0, 0, 0, 2, 0, '');
    INSERT INTO cards VALUES (1003, 101, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, '');
    CREATE TABLE revlog (id integer, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer);
    INSERT INTO revlog VALUES (1720000000000, 1000, 0, 3, 30, 15, 2500, 3000, 1);
    INSERT INTO revlog VALUES (1710000000000, 1000, 0, 1, 0, 15, 2300, 5000, 2);
  `);
  const bytes = db.export();
  db.close();
  return new Uint8Array(bytes);
}

function cardDataWithMemoryState(stability: number, difficulty: number): Uint8Array {
  const inner = new Uint8Array(10);
  const v = new DataView(inner.buffer);
  inner[0] = 0x0d; v.setFloat32(1, stability, true);
  inner[5] = 0x15; v.setFloat32(6, difficulty, true);
  const outer = new Uint8Array(2 + inner.length);
  outer[0] = (4 << 3) | 2; // field 4, wire 2
  outer[1] = inner.length;
  outer.set(inner, 2);
  return outer;
}

describe('extractMemoryStateFromCardData', () => {
  it('finds embedded memory_state submessage', () => {
    const blob = cardDataWithMemoryState(55.5, 7.25);
    expect(extractMemoryStateFromCardData(blob)).toEqual({ stability: 55.5, difficulty: 7.25 });
  });
});

describe('parseApkg', () => {
  it('parses collection.anki2 + media map end-to-end', async () => {
    const collection = await buildCollectionSql();
    const zip = zipSync({
      'collection.anki2': collection,
      media: strToU8(JSON.stringify({ '0': 'w.mp3' })),
      '0': strToU8('fake audio bytes'),
    });
    const data = await parseApkg(zip);

    expect(data.source).toBe('apkg');
    expect(data.fidelity).toBe('full');
    expect(data.crtMs).toBe(1700000000 * 1000);
    expect(data.decks).toEqual([
      { id: '1', name: 'Default', filtered: false, desiredRetention: 0.9 },
      { id: '2', name: 'Lang::JP::Core', filtered: false, desiredRetention: 0.9 },
      { id: '9', name: 'Filtered', filtered: true, desiredRetention: undefined },
    ]);
    expect(data.notetypes.map((n) => [n.id, n.isCloze])).toEqual([['111', false], ['222', true]]);
    expect(data.notetypes[0]!.fields).toEqual([
      { name: 'Front', ord: 0 }, { name: 'Back', ord: 1 },
    ]);
    expect(data.notes[0]!.fields).toEqual(['捨てる', 'to throw away [sound:w.mp3]']);
    expect(data.notes[0]!.tags).toEqual(['verb']);
    expect(data.cards).toHaveLength(4);
    expect(data.cards[0]).toMatchObject({ id: 1000, deckId: '2', type: 2, queue: 2, ivl: 30, odid: 0 });
    expect(data.revlog).toHaveLength(2);
    expect(data.hasScheduling).toBe(true);

    const media = await data.media.resolve('w.mp3');
    expect(media?.mimeType).toBe('audio/mpeg');
    expect(new TextDecoder().decode(media!.bytes)).toBe('fake audio bytes');
    expect(await data.media.resolve('missing.png')).toBeNull();
  });

  it('rejects non-zip', async () => {
    await expect(parseApkg(new Uint8Array([1, 2, 3]))).rejects.toMatchObject({ code: 'NOT_ZIP' });
  });

  it('rejects stub collection.anki2 (new-format placeholder)', async () => {
    const zip = zipSync({ 'collection.anki2': strToU8('This file requires a newer version of Anki.') });
    await expect(parseApkg(zip)).rejects.toMatchObject({ code: 'STUB_ANKI2' });
  });

  it('prefers collection.anki21b and decodes zstd', async () => {
    const { zstdCompressSync } = await import('node:zlib');
    const collection = await buildCollectionSql();
    const zip = zipSync({ 'collection.anki21b': new Uint8Array(zstdCompressSync(Buffer.from(collection))) });
    const data = await parseApkg(zip);
    expect(data.cards).toHaveLength(4);
  });

  it('flags missing scheduling', async () => {
    const initSqlJs = jest.requireActual('sql.js/dist/sql-wasm.js');
    const SQL = await initSqlJs({ locateFile: (f: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f) });
    const db = new SQL.Database();
    db.exec(`
      CREATE TABLE col (id integer, crt integer, conf text, models text, decks text, dconf text);
      INSERT INTO col VALUES (1, 1700000000, '{}', '{}', '{"1":{"name":"D","dyn":0}}', '{}');
      CREATE TABLE notes (id integer, mid integer, tags text, flds text);
      CREATE TABLE cards (id integer, nid integer, did integer, ord integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odid integer, data blob);
      INSERT INTO cards VALUES (1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '');
      CREATE TABLE revlog (id integer, cid integer, ease integer, ivl integer, time integer);
    `);
    const zip = zipSync({ 'collection.anki2': new Uint8Array(db.export()) });
    db.close();
    const data = await parseApkg(zip);
    expect(data.hasScheduling).toBe(false);
  });
});
