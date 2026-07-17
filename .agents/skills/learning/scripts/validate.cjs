#!/usr/bin/env node
/**
 * validate.cjs — check learning skill knowledge store integrity.
 *
 * Checks:
 *   1. index.json is valid JSON
 *   2. knowledge/*.json (topic files) are valid JSON with rules[]
 *   3. experience/*.json (atom files) are valid JSON with required fields
 *   4. Index entries match files in both directories
 *   5. No duplicate ids
 *   6. Required fields present in each experience atom
 *   7. Each experience case has context + bad + good
 *   8. Knowledge rules have id + principle + cases
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(SKILL_DIR, 'index.json');
const KNOWLEDGE_DIR = path.join(SKILL_DIR, 'knowledge');
const EXPERIENCE_DIR = path.join(SKILL_DIR, 'experience');

const REQUIRED_EXP_FIELDS = ['id', 'title', 'category', 'tags', 'trigger', 'principle', 'cases', 'applyFor'];
const REQUIRED_CASE_FIELDS = ['context', 'bad', 'good'];
const REQUIRED_RULE_FIELDS = ['id', 'title', 'category', 'tags', 'trigger', 'principle', 'cases', 'applyFor'];

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
const indexKnowledgeTopics = new Set();
const indexExperienceIds = new Set();
const seenIds = new Set();

for (const entry of index.principles) {
  if (entry.type === 'knowledge') {
    if (!entry.topic) { fail(`index knowledge entry missing topic: ${JSON.stringify(entry)}`); continue; }
    if (seenIds.has('k:' + entry.topic)) { fail(`index duplicate knowledge topic: ${entry.topic}`); continue; }
    seenIds.add('k:' + entry.topic);
    indexKnowledgeTopics.add(entry.topic);
  } else if (entry.type === 'experience') {
    if (!entry.id) { fail(`index experience entry missing id: ${JSON.stringify(entry)}`); continue; }
    if (seenIds.has('e:' + entry.id)) { fail(`index duplicate experience id: ${entry.id}`); continue; }
    seenIds.add('e:' + entry.id);
    indexExperienceIds.add(entry.id);
  } else {
    fail(`index entry unknown type "${entry.type}": ${JSON.stringify(entry)}`);
  }
}

// 2. Validate knowledge/*.json (topic files)
const knowledgeFiles = fs.existsSync(KNOWLEDGE_DIR) ? fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json')) : [];
const fileKnowledgeTopics = new Set();
const allRuleIds = new Set();

for (const file of knowledgeFiles) {
  const filePath = path.join(KNOWLEDGE_DIR, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`${file}: ${e.message}`);
    continue;
  }

  if (!data.topic) { fail(`${file}: missing "topic"`); continue; }
  if (fileKnowledgeTopics.has(data.topic)) { fail(`${file}: duplicate topic "${data.topic}"`); continue; }
  fileKnowledgeTopics.add(data.topic);

  if (!Array.isArray(data.rules)) { fail(`${file}: missing "rules" array`); continue; }

  for (const rule of data.rules) {
    if (!rule.id) { fail(`${file}: rule missing id`); continue; }
    if (allRuleIds.has(rule.id)) { fail(`${file}: duplicate rule id "${rule.id}"`); continue; }
    allRuleIds.add(rule.id);

    for (const field of REQUIRED_RULE_FIELDS) {
      if (!(field in rule)) fail(`${file}: rule "${rule.id}" missing field "${field}"`);
    }

    if (Array.isArray(rule.cases)) {
      rule.cases.forEach((c, i) => {
        for (const field of REQUIRED_CASE_FIELDS) {
          if (!(field in c)) fail(`${file}: rule "${rule.id}" cases[${i}] missing "${field}"`);
        }
      });
    }
  }

  if (!indexKnowledgeTopics.has(data.topic)) {
    fail(`${file}: knowledge topic "${data.topic}" has no index entry`);
  }
}

// 3. Validate experience/*.json (atom files)
const expFiles = fs.existsSync(EXPERIENCE_DIR) ? fs.readdirSync(EXPERIENCE_DIR).filter(f => f.endsWith('.json')) : [];
const expIds = new Set();

for (const file of expFiles) {
  const filePath = path.join(EXPERIENCE_DIR, file);
  let atom;
  try {
    atom = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`${file}: ${e.message}`);
    continue;
  }

  if (!atom.id) { fail(`${file}: missing "id"`); continue; }
  if (expIds.has(atom.id)) { fail(`${file}: duplicate id "${atom.id}"`); continue; }
  expIds.add(atom.id);

  for (const field of REQUIRED_EXP_FIELDS) {
    if (!(field in atom)) fail(`${file}: missing field "${field}"`);
  }

  if (Array.isArray(atom.cases)) {
    atom.cases.forEach((c, i) => {
      for (const field of REQUIRED_CASE_FIELDS) {
        if (!(field in c)) fail(`${file}: cases[${i}] missing "${field}"`);
      }
    });
  }

  if (Array.isArray(atom.category)) {
    for (const cat of atom.category) {
      if (allowedCategories.size > 0 && !allowedCategories.has(cat)) {
        fail(`${file}: category "${cat}" not in index.categories[]`);
      }
    }
  }

  if (!indexExperienceIds.has(atom.id)) {
    fail(`${file}: experience atom "${atom.id}" has no index entry`);
  }
}

// 4. Check index entries have files
for (const topic of indexKnowledgeTopics) {
  if (!fileKnowledgeTopics.has(topic)) {
    fail(`index knowledge topic "${topic}" has no knowledge/${topic}.json file`);
  }
}
for (const id of indexExperienceIds) {
  if (!expIds.has(id)) {
    fail(`index experience id "${id}" has no experience/${id}.json file`);
  }
}

// Summary
const totalRules = allRuleIds.size;
const totalAtoms = expIds.size;
if (errors === 0) {
  console.log(`OK: ${knowledgeFiles.length} knowledge topics (${totalRules} rules), ${totalAtoms} experience atoms, ${allowedCategories.size} categories`);
  process.exit(0);
} else {
  console.error(`\n${errors} violation(s) across ${totalRules} rules + ${totalAtoms} atoms`);
  process.exit(1);
}
