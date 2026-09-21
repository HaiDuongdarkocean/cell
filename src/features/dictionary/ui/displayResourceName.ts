const STRIPPED_EXTENSIONS = new Set([
  'json', 'zip', 'txt', 'db', 'gz', 'sqlite', 'sqlite3',
  'csv', 'tsv', 'dic', 'bank', 'normalized',
]);

export function displayResourceName(name: string): string {
  let out = name;
  while (true) {
    const i = out.lastIndexOf('.');
    if (i <= 0 || !STRIPPED_EXTENSIONS.has(out.slice(i + 1).toLowerCase())) return out;
    out = out.slice(0, i);
  }
}
