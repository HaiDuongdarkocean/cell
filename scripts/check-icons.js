#!/usr/bin/env node
/**
 * Icon QC script — validates icon design system compliance
 * Usage: node scripts/check-icons.js
 *
 * Checks:
 * - viewBox is "0 0 24 24"
 * - stroke-width is "1.5"
 * - stroke-linecap is "round"
 * - stroke-linejoin is "round"
 * - no transforms (translate, scale)
 * - no disallowed elements (script, style, foreignObject)
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ICONS_DIR = join(process.cwd(), 'src/shared/icons/svg');

const errors = [];

function checkIcon(filePath, fileName) {
  const content = readFileSync(filePath, 'utf-8');

  // Check viewBox
  if (!content.includes('viewBox="0 0 24 24"')) {
    errors.push({ file: fileName, error: 'Missing or incorrect viewBox (must be "0 0 24 24")' });
  }

  // Check stroke-width
  if (!content.includes('stroke-width="1.5"')) {
    errors.push({ file: fileName, error: 'Missing or incorrect stroke-width (must be "1.5")' });
  }

  // Check stroke-linecap
  if (!content.includes('stroke-linecap="round"')) {
    errors.push({ file: fileName, error: 'Missing or incorrect stroke-linecap (must be "round")' });
  }

  // Check stroke-linejoin
  if (!content.includes('stroke-linejoin="round"')) {
    errors.push({ file: fileName, error: 'Missing or incorrect stroke-linejoin (must be "round")' });
  }

  // Check for disallowed transforms
  if (content.includes('transform=') || content.includes('translate(') || content.includes('scale(')) {
    errors.push({ file: fileName, error: 'Contains transform/translate/scale (not allowed)' });
  }

  // Check for disallowed elements
  if (content.includes('<script') || content.includes('<style') || content.includes('<foreignObject')) {
    errors.push({ file: fileName, error: 'Contains disallowed element (script, style, foreignObject)' });
  }
}

const files = readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg'));

for (const file of files) {
  const filePath = join(ICONS_DIR, file);
  checkIcon(filePath, file);
}

if (errors.length === 0) {
  console.log(`✓ All ${files.length} icons pass QC checks`);
  process.exit(0);
} else {
  console.error(`\n❌ ${errors.length} icon QC error(s) found:\n`);
  for (const { file, error } of errors) {
    console.error(`  ${file}: ${error}`);
  }
  process.exit(1);
}
