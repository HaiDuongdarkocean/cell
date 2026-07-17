// One runnable check: validate the 2 atomic convention JSONs after any CRUD edit.
// Run: node scripts/validate.cjs
// Exits non-zero on any violation. No external deps.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'conventions');
const FILES = ['htmlcss-style-guide.json', 'typescript-style-guide.json'];
const REQUIRED = ['id', 'category', 'severity', 'trigger', 'rule', 'sourceAnchor'];
const SEVERITIES = ['MUST', 'MUST_NOT', 'SHOULD', 'SHOULD_NOT', 'MAY'];
let errors = [];

for (const f of FILES) {
  const p = path.join(DIR, f);
  let raw, doc;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (e) { errors.push(`${f}: cannot read (${e.message})`); continue; }
  try { doc = JSON.parse(raw); } catch (e) { errors.push(`${f}: invalid JSON (${e.message})`); continue; }
  if (typeof doc.apiVersion !== 'string') errors.push(`${f}: missing apiVersion`);
  if (!doc.data || !Array.isArray(doc.data.items)) { errors.push(`${f}: missing data.items array`); continue; }
  if (typeof doc.data.totalItems !== 'number') errors.push(`${f}: missing data.totalItems`);
  else if (doc.data.totalItems !== doc.data.items.length) errors.push(`${f}: totalItems(${doc.data.totalItems}) !== items.length(${doc.data.items.length})`);
  if (!Array.isArray(doc.data.categories)) errors.push(`${f}: missing data.categories`);
  else {
    const actual = [...new Set(doc.data.items.map(r => r.category))].sort();
    const declared = [...doc.data.categories].sort();
    if (actual.join(',') !== declared.join(',')) errors.push(`${f}: categories mismatch (declared vs actual)`);
  }
  const seen = new Set();
  doc.data.items.forEach((r, i) => {
    for (const field of REQUIRED) if (!(field in r)) errors.push(`${f} items[${i}]: missing "${field}"`);
    if (r.severity && !SEVERITIES.includes(r.severity)) errors.push(`${f} ${r.id}: bad severity "${r.severity}"`);
    if (r.id) { if (seen.has(r.id)) errors.push(`${f}: duplicate id "${r.id}"`); seen.add(r.id); }
  });
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} violation(s)`);
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
}
const counts = FILES.map(f => {
  const doc = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  return `${f}: ${doc.data.items.length} rules, ${doc.data.categories.length} categories`;
});
console.log(`OK: ${counts.join(' | ')}`);
