// SQLite reader — langResourceEntry table (term, reading, definition).

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export async function* iterSqlite(bytes) {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs({
    locateFile: (f) => join(ROOT, 'node_modules/sql.js/dist', f),
  });
  const db = new SQL.Database(bytes);
  try {
    const result = db.exec('SELECT term, reading, definition FROM langResourceEntry');
    if (result.length === 0) throw new Error('no langResourceEntry table');
    const { columns, values } = result[0];
    const ti = columns.indexOf('term');
    const ri = columns.indexOf('reading');
    const di = columns.indexOf('definition');
    for (const row of values) {
      const term = String(row[ti] ?? '');
      if (term) yield { term, reading: String(row[ri] ?? term), definition: String(row[di] ?? '') };
    }
  } finally {
    db.close();
  }
}
