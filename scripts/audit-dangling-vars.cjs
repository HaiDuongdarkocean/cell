// Audit: var(--x) references never defined (CSS decl, tokens.css, or runtime quoted name).
// Pure node — no shell quoting issues.
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const SKIP_DIR = /[\\/](mockups|mockup-[^\\/]*|mock-[^\\/]*|node_modules)[\\/]/;
const SKIP_FILE = /(\.test\.|\.showcase\.|tokens\.css$)/;
const EXT = /\.(css|ts|tsx)$/;

const refs = new Set();
const defs = new Set();
const refAt = new Map();

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.test(p + path.sep)) walk(p); continue; }
    if (!EXT.test(e.name) || SKIP_FILE.test(e.name)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const m of text.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
      refs.add(m[1]);
      if (!refAt.has(m[1])) refAt.set(m[1], path.relative(process.cwd(), p));
    }
    for (const m of text.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defs.add(m[1]);
    for (const m of text.matchAll(/['"`](--[a-zA-Z0-9-]+)['"`]/g)) defs.add(m[1]);
  }
}
walk(SRC);
// tokens.css is generated — include it as a definition source
const tokensCss = fs.readFileSync(path.join(SRC, 'shared', 'styles', 'tokens.css'), 'utf8');
for (const m of tokensCss.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defs.add(m[1]);

const dangling = [...refs].filter((r) => !defs.has(r) && !r.endsWith('-')).sort();
console.log('referenced:', refs.size, '| defined:', defs.size);
if (!dangling.length) console.log('dangling: NONE');
else for (const d of dangling) console.log('  ' + d.padEnd(40) + ' @ ' + refAt.get(d));
