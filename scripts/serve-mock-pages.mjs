#!/usr/bin/env node
/**
 * Serve mock streaming pages for extension testing.
 *
 * Builds the mock pages (`npm run build:mock`), copies mock page HTML + assets
 * to a standalone folder, fixes asset paths to relative, and serves via http-server
 * in-process so Playwright can stop the whole process tree cleanly.
 *
 * Usage:
 *   node scripts/serve-mock-pages.mjs              # serve both (default ports 4321/4322)
 *   node scripts/serve-mock-pages.mjs --stream      # serve StreamFlix only
 *   node scripts/serve-mock-pages.mjs --youtube     # serve YouTube only
 *   node scripts/serve-mock-pages.mjs --build-only  # build + copy, no serve
 */

import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { createServer } from 'http-server';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist-mock-pages');

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const agentName = (process.env.PW_OUTPUT_DIR || '').trim() || 'default';
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const STAGING_ROOT = resolve(ROOT, 'e2e-results', agentName, 'staging');

const PAGES = [
  {
    name: 'StreamFlix',
    id: 'mock-streaming-page',
    port: 4321,
    distHtml: resolve(DIST, 'src/entrypoints/mock-streaming-page/index.html'),
    outDir: resolve(STAGING_ROOT, 'mock-servers', `mock-streaming-${runId}`),
  },
  {
    name: 'StreamFlixIframe',
    id: 'mock-streaming-iframe-page',
    port: 4323,
    distHtml: resolve(DIST, 'src/entrypoints/mock-streaming-iframe-page/index.html'),
    outDir: resolve(STAGING_ROOT, 'mock-servers', `mock-streaming-iframe-${runId}`),
  },
  {
    name: 'IframePlayer',
    id: 'mock-iframe-player',
    port: 4324,
    distHtml: resolve(DIST, 'src/entrypoints/mock-iframe-player/index.html'),
    outDir: resolve(STAGING_ROOT, 'mock-servers', `mock-iframe-player-${runId}`),
  },
  {
    name: 'YouTube',
    id: 'mock-youtube',
    port: 4322,
    distHtml: resolve(DIST, 'src/entrypoints/mock-youtube/index.html'),
    outDir: resolve(STAGING_ROOT, 'mock-servers', `mock-youtube-${runId}`),
  },
  {
    name: 'HardSub',
    id: 'mock-hardsub-page',
    port: 4325,
    distHtml: resolve(DIST, 'src/entrypoints/mock-hardsub-page/index.html'),
    outDir: resolve(STAGING_ROOT, 'mock-servers', `mock-hardsub-${runId}`),
  },
  {
    name: 'YouTubeHardsub',
    id: 'mock-youtube-hardsub',
    port: 4326,
    distHtml: resolve(DIST, 'src/entrypoints/mock-youtube-hardsub/index.html'),
    outDir: resolve(STAGING_ROOT, 'mock-servers', `mock-youtube-hardsub-${runId}`),
    // The 82MB test video + SRT live outside the bundle (would bloat every build).
    // Copy them straight from the data folder into the mock output assets dir.
    extraAssets: [
      { from: resolve(ROOT, 'data/resource/media/video subtitle test ocr/How Have You Been.mp4'), to: 'HowHaveYouBeen.mp4' },
    ],
  },
];

const args = process.argv.slice(2);
const streamOnly = args.includes('--stream');
const streamIframeOnly = args.includes('--stream-iframe');
const youtubeOnly = args.includes('--youtube');
const buildOnly = args.includes('--build-only');
const noBuild = args.includes('--no-build');

// --stream-iframe serves the cross-origin iframe host (4323) + child player
// (4324) together — both are required for the iframe flow to work.
const selected = streamOnly ? PAGES.filter(p => p.id === 'mock-streaming-page')
  : streamIframeOnly ? PAGES.filter(p => p.id === 'mock-streaming-iframe-page' || p.id === 'mock-iframe-player')
  : youtubeOnly ? PAGES.filter(p => p.id === 'mock-youtube')
  : PAGES;

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function preparePage(page) {
  if (!existsSync(page.distHtml)) {
    console.error(`✗ ${page.name}: build output not found at ${page.distHtml}`);
    console.error('  Run "npm run build" first or remove --no-build flag.');
    process.exit(1);
  }

  // Clean + recreate output dir
  if (existsSync(page.outDir)) {
    rmSync(page.outDir, { recursive: true, force: true });
  }
  mkdirSync(resolve(page.outDir, 'assets'), { recursive: true });

  // Copy index.html
  let html = readFileSync(page.distHtml, 'utf-8');
  // Fix absolute asset paths → relative
  html = html.replace(/"\/assets\//g, '"./assets/');
  writeFileSync(resolve(page.outDir, 'index.html'), html);

  // Copy assets
  const distAssets = resolve(DIST, 'assets');
  if (existsSync(distAssets)) {
    cpSync(distAssets, resolve(page.outDir, 'assets'), { recursive: true });
  }

  // Copy extra out-of-bundle assets (e.g. the 82MB test video) straight from
  // their source into the mock output assets dir — keeps them out of the build.
  if (page.extraAssets) {
    for (const asset of page.extraAssets) {
      if (!existsSync(asset.from)) {
        console.error(`✗ ${page.name}: extra asset not found at ${asset.from}`);
        continue;
      }
      cpSync(asset.from, resolve(page.outDir, 'assets', asset.to));
      console.log(`  ↳ copied ${asset.to}`);
    }
  }

  console.log(`✓ ${page.name}: prepared at ${page.outDir}`);
  console.log(`  index written: ${existsSync(resolve(page.outDir, 'index.html'))}`);
  console.log(`  assets dir: ${existsSync(resolve(page.outDir, 'assets'))}`);
  console.log(`  asset count: ${readdirSync(page.outDir).length}`);


}

function servePage(page) {
  const port = page.port + portOffset;
  console.log(`\n▶ Serving ${page.name} at http://127.0.0.1:${port}/index.html`);
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

// === Main ===
console.log('=== Mock Streaming Pages Server ===\n');

if (!noBuild) {
  run('npm run build:mock', 'Building mock pages');
}

for (const page of selected) {
  preparePage(page);
}

if (buildOnly) {
  console.log('\n✓ Build-only mode: pages prepared, skipping serve.');
  console.log('  Output directories:');
  for (const page of selected) {
    console.log(`    ${page.name}: ${page.outDir}`);
  }
  process.exit(0);
}

const servers = [];
for (const page of selected) {
  servers.push(servePage(page));
}

console.log('\n=== Servers running ===');
for (const page of selected) {
  console.log(`  ${page.name}:  http://127.0.0.1:${page.port + portOffset}/index.html`);
}
console.log('\n  Press Ctrl+C to stop all servers.\n');

// Keep process alive, close all servers on exit
process.on('SIGINT', () => {
  console.log('\nStopping servers...');
  for (const s of servers) {
    try { s.close(); } catch {}
  }
  process.exit(0);
});
