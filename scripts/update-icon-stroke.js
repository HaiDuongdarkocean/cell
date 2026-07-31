#!/usr/bin/env node
/**
 * Batch update SVG stroke-width from 2 to 1.5
 * Usage: node scripts/update-icon-stroke.js
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ICONS_DIR = join(process.cwd(), 'src/shared/icons/svg');

function updateStrokeWidth(svgContent) {
  // Replace stroke-width="2" with stroke-width="1.5"
  // Also update comments that mention stroke 2
  let updated = svgContent
    .replace(/stroke-width="2"/g, 'stroke-width="1.5"')
    .replace(/stroke 2\.0/g, 'stroke 1.5')
    .replace(/stroke 2/g, 'stroke 1.5');

  return updated;
}

function main() {
  const files = readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg'));
  let updatedCount = 0;

  for (const file of files) {
    const filePath = join(ICONS_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const updated = updateStrokeWidth(content);

    if (updated !== content) {
      writeFileSync(filePath, updated, 'utf-8');
      updatedCount++;
      console.log(`✓ Updated ${file}`);
    }
  }

  console.log(`\nUpdated ${updatedCount} icon files`);
}

main();
