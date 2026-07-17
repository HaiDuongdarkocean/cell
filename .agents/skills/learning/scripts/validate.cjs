#!/usr/bin/env node
/**
 * validate.cjs — check knowledge store integrity.
 *
 * Run after ANY change to index.json or knowledge/*.json:
 *   node scripts/validate.cjs
 *
 * Checks:
 *   1. index.json is valid JSON
 *   2. Every knowledge/*.json is valid JSON
 *   3. Every index entry has a matching knowledge/<id>.json file
 *   4. Every knowledge/<id>.json has an index entry
 *   5. No duplicate ids in index
 *   6. Required fields present in each atom (id, title, category, tags, trigger, principle, cases, applyFor)
 *   7. Each case has context + bad + good
 *   8. All categories in atoms exist in index.categories[]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(SKILL_DIR, 'index.json');
const KNOWLEDGE_DIR = path.join(SKILL_DIR, 'knowledge');

const REQUIRED_ATOM_FIELDS = ['id', 'title', 'category', 'tags', 'trigger', 'principle', 'cases', 'applyFor'];
const REQUIRED_CASE_FIELDS = ['context', 'bad', 'good'];

let errors = 0;
function fail(msg) { console.error(`FAIL: ${msg}`); errors++; }

// 1. Load + validate index.json
let index;
try {
  index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
} catch (e) {
  fail(`index.json: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(index.principles)) {
  fail('index.json: missing "principles" array');
  process.exit(1);
}

const allowedCategories = new Set(index.categories || []);
const indexIds = new Set();
const seenIds = new Set();

for (const entry of index.principles) {
  if (!entry.id) { fail(`index entry missing id: ${JSON.stringify(entry)}`); continue; }
  if (seenIds.has(entry.id)) { fail(`index duplicate id: ${entry.id}`); continue; }
  seenIds.add(entry.id);
  indexIds.add(entry.id);
  for (const field of ['id', 'title', 'category', 'tags', 'trigger']) {
    if (!(field in entry)) fail(`index entry "${entry.id}" missing field: ${field}`);
  }
}

// 2-4. Load + validate knowledge/*.json, check sync with index
const atomFiles = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json'));
const atomIds = new Set();

for (const file of atomFiles) {
  const filePath = path.join(KNOWLEDGE_DIR, file);
  let atom;
  try {
    atom = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`${file}: ${e.message}`);
    continue;
  }

  if (!atom.id) { fail(`${file}: missing "id"`); continue; }
  if (atomIds.has(atom.id)) { fail(`${file}: duplicate id "${atom.id}"`); continue; }
  atomIds.add(atom.id);

  // 6. Required fields
  for (const field of REQUIRED_ATOM_FIELDS) {
    if (!(field in atom)) fail(`${file}: missing field "${field}"`);
  }

  // 7. Each case has context + bad + good
  if (Array.isArray(atom.cases)) {
    atom.cases.forEach((c, i) => {
      for (const field of REQUIRED_CASE_FIELDS) {
        if (!(field in c)) fail(`${file}: cases[${i}] missing "${field}"`);
      }
    });
  }

  // 8. Categories valid
  if (Array.isArray(atom.category)) {
    for (const cat of atom.category) {
      if (allowedCategories.size > 0 && !allowedCategories.has(cat)) {
        fail(`${file}: category "${cat}" not in index.categories[]`);
      }
    }
  }

  // 4. Atom has index entry?
  if (!indexIds.has(atom.id)) {
    fail(`${file}: atom "${atom.id}" has no index entry`);
  }
}

// 3. Index entry has atom file?
for (const id of indexIds) {
  if (!atomIds.has(id)) {
    fail(`index entry "${id}" has no knowledge/${id}.json file`);
  }
}

// Summary
const total = indexIds.size;
if (errors === 0) {
  console.log(`OK: ${total} principles, ${atomFiles.length} atom files, ${allowedCategories.size} categories`);
  process.exit(0);
} else {
  console.error(`\n${errors} violation(s) across ${total} principles`);
  process.exit(1);
}
