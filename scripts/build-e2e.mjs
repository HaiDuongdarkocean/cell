#!/usr/bin/env node
/**
 * Build all artifacts needed for E2E testing.
 *
 * Sets CELL_E2E=1 before the extension build so test-only debug markers
 * (data-cell-runscan, __CELL_DEBUG_PAGE_SCAN) are compiled in. The flag is
 * NOT set for the mock/pages/design-system builds, which do not need it.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function run(cmd, label, extraEnv = {}) {
  console.log(`\n▶ ${label}: ${cmd}`);
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

process.env.CELL_E2E = '1';
run('npm run build', 'Building extension with E2E debug markers');

// Clear the flag for the other builds — they do not need it.
delete process.env.CELL_E2E;
run('npm run build:mock', 'Building mock streaming pages');
run('npm run build:design-system', 'Building design-system showcase');
run('npm run build:pages', 'Building standalone test pages');

console.log('\n✓ All E2E build artifacts ready.');
