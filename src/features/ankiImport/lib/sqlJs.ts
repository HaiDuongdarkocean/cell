export interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}
export interface SqlJsDatabase {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  close(): void;
}

/** Lazy-load sql.js; wasm served from web_accessible_resources in the extension. */
export async function loadSqlJs(): Promise<SqlJsStatic> {
  const initSqlJs = (await import('sql.js')).default;
  return initSqlJs({
    locateFile: (file: string) => {
      const mapped = file.replace('sql-wasm-browser.wasm', 'sql-wasm.wasm');
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(mapped);
      }
      return mapped;
    },
  }) as Promise<SqlJsStatic>;
}
