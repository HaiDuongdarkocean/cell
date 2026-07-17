#!/usr/bin/env node
/**
 * convert-conventions.cjs — convert code-convention style guides to learning/knowledge/ schema.
 *
 * Input:  .agents/skills/code-convention/conventions/{htmlcss,typescript}-style-guide.json
 * Output: .agents/skills/learning/knowledge/{htmlcss,typescript}.json
 *
 * Each output file:
 * {
 *   "topic": "htmlcss",
 *   "source": "https://...",
 *   "rules": [
 *     {
 *       "id": "htmlcss-bem-block-naming",
 *       "title": "BEM block naming",
 *       "category": ["css", "naming"],
 *       "tags": [...],
 *       "trigger": "...",
 *       "principle": "...",
 *       "cases": [{"context": "...", "bad": "...", "good": "..."}],
 *       "applyFor": [...]
 *     }
 *   ]
 * }
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CONVENTION_DIR = path.resolve(__dirname, '..', '..', 'code-convention', 'conventions');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'knowledge');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const FILES = [
  { input: 'htmlcss-style-guide.json', output: 'htmlcss.json', topic: 'htmlcss' },
  { input: 'typescript-style-guide.json', output: 'typescript.json', topic: 'typescript' },
];

// Map category to tags — derive grep-able tags from category + trigger
function deriveTags(item, topic) {
  const tags = [topic];
  if (item.category) tags.push(item.category);
  // Extract keywords from trigger
  if (item.trigger) {
    const words = item.trigger.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    tags.push(...words.slice(0, 2));
  }
  // Dedup
  return [...new Set(tags)].slice(0, 5);
}

// Map category to learning categories
const CATEGORY_MAP = {
  // htmlcss
  'css': 'css', 'general': 'css', 'html': 'css', 'naming': 'css',
  // typescript
  'classes': 'build', 'comments': 'build', 'controlFlow': 'build',
  'errorHandling': 'build', 'exports': 'build', 'functions': 'build',
  'imports': 'build', 'jsdoc': 'build', 'languageFeatures': 'build',
  'misc': 'build', 'naming': 'build', 'sourceFile': 'build',
  'typeAnnotations': 'build', 'types': 'build',
};

function mapCategory(item, topic) {
  const cat = CATEGORY_MAP[item.category] || 'build';
  // For htmlcss, use more specific categories
  if (topic === 'htmlcss') {
    if (item.category === 'html') return ['css'];
    if (item.category === 'naming') return ['css'];
    return ['css'];
  }
  // For typescript, map to build + testing
  return [cat];
}

// Convert a single rule item to new schema
function convertRule(item, topic) {
  const id = `${topic}-${item.id}`;
  const title = item.rule ? item.rule.split('.')[0].slice(0, 80) : item.trigger || id;
  
  // Build cases from example
  const cases = [];
  if (item.example) {
    const ctx = item.trigger || 'When applying this rule';
    if (item.example.bad && item.example.bad.length > 0) {
      cases.push({
        context: ctx,
        bad: item.example.bad.join('\n'),
        good: item.example.good ? item.example.good.join('\n') : ''
      });
    } else if (item.example.good && item.example.good.length > 0) {
      cases.push({
        context: ctx,
        bad: '',
        good: item.example.good.join('\n')
      });
    }
  }

  // If no example, create a case from rule text
  if (cases.length === 0) {
    cases.push({
      context: item.trigger || 'General',
      bad: '',
      good: item.rule || ''
    });
  }

  return {
    id: id,
    title: title,
    category: mapCategory(item, topic),
    tags: deriveTags(item, topic),
    trigger: item.trigger || title,
    principle: item.rule || title,
    cases: cases,
    applyFor: topic === 'htmlcss' 
      ? ['HTML', 'CSS', 'SCSS', 'CSS Modules']
      : ['TypeScript', 'JavaScript', 'TSX', 'JSX']
  };
}

for (const { input, output, topic } of FILES) {
  const inputPath = path.join(CONVENTION_DIR, input);
  if (!fs.existsSync(inputPath)) {
    console.error(`SKIP: ${inputPath} not found`);
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const items = raw.data.items || [];
  const source = raw.data.sourceGuide || '';
  
  const rules = items.map(item => convertRule(item, topic));
  
  const result = {
    topic: topic,
    source: source,
    rules: rules
  };
  
  const outputPath = path.join(OUTPUT_DIR, output);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`Converted ${items.length} rules → ${outputPath}`);
}
