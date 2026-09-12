#!/usr/bin/env node
/**
 * Serve standalone non-extension test pages (launcher, mockups, etc.).
 *
 * Copies built page HTML + assets to a unique per-run directory and serves
 * them via http-server on an offset port. This keeps each test page at the
 * server root, so Playwright `page.goto('/')` works and assets do not need
 * to escape the server root.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { createServer } from 'http-server';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist-pages');

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const agentName = (process.env.PW_OUTPUT_DIR || '').trim() || 'default';
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const STAGING_ROOT = resolve(ROOT, 'e2e-results', agentName, 'staging');

const PAGES = [
  {
    name: 'LauncherDashboard',
    id: 'launcher-dashboard',
    port: 8124,
    distHtml: resolve(DIST, 'src/entrypoints/launcher-dashboard/index.html'),
    outDir: resolve(STAGING_ROOT, 'test-pages', `launcher-dashboard-${runId}`),
  },
  {
    name: 'MockupLanguageProfile',
    id: 'mockup-language-profile',
    port: 5173,
    distHtml: resolve(DIST, 'src/entrypoints/mockup-language-profile/index.html'),
    outDir: resolve(STAGING_ROOT, 'test-pages', `mockup-language-profile-${runId}`),
  },
];

const args = process.argv.slice(2);
const launcherOnly = args.includes('--launcher');
const profileOnly = args.includes('--profile');

const selected = launcherOnly
  ? PAGES.filter((p) => p.id === 'launcher-dashboard')
  : profileOnly
  ? PAGES.filter((p) => p.id === 'mockup-language-profile')
  : PAGES;

function preparePage(page) {
  if (!existsSync(page.distHtml)) {
    console.error(`✗ ${page.name}: build output not found at ${page.distHtml}`);
    console.error('  Run "npm run build:pages" first.');
    process.exit(1);
  }

  if (existsSync(page.outDir)) {
    rmSync(page.outDir, { recursive: true, force: true });
  }
  mkdirSync(resolve(page.outDir, 'assets'), { recursive: true });

  let html = readFileSync(page.distHtml, 'utf-8');
  html = html.replace(/"\/assets\//g, '"./assets/');
  writeFileSync(resolve(page.outDir, 'index.html'), html);

  const distAssets = resolve(DIST, 'assets');
  if (existsSync(distAssets)) {
    cpSync(distAssets, resolve(page.outDir, 'assets'), { recursive: true });
  }

  console.log(`✓ ${page.name}: prepared at ${page.outDir}`);
}

function servePage(page) {
  const port = page.port + portOffset;
  console.log(`\n▶ Serving ${page.name} at http://127.0.0.1:${port}/`);
  const server = createServer({
    root: page.outDir,
    cors: true,
    cache: -1,
    showDir: false,
    autoIndex: true,
    logFn: (req, res) => {
      if (res.statusCode >= 400) {
        console.error(`[${page.name}] ${res.statusCode} ${req.url}`);
      }
    },
  });
  server.server.on('error', (err) => {
    console.error(`✗ ${page.name}: server error: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1');
  return server;
}

console.log('=== Test Pages Server ===\n');

for (const page of selected) {
  preparePage(page);
}

const servers = [];
for (const page of selected) {
  servers.push(servePage(page));
}

console.log('\n=== Servers running ===');
for (const page of selected) {
  console.log(`  ${page.name}:  http://127.0.0.1:${page.port + portOffset}/`);
}
console.log('\n  Press Ctrl+C to stop all servers.\n');

process.on('SIGINT', () => {
  console.log('\nStopping servers...');
  for (const s of servers) {
    try { s.close(); } catch {}
  }
  process.exit(0);
});
