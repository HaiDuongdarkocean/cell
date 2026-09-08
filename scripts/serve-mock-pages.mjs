#!/usr/bin/env node
/**
 * Serve mock streaming pages for extension testing.
 *
 * Builds the mock pages (`npm run build:mock`), copies mock page HTML + assets
 * to a standalone folder, fixes asset paths to relative, and serves via http-server.
 *
 * Usage:
 *   node scripts/serve-mock-pages.mjs              # serve both (default ports 4321/4322)
 *   node scripts/serve-mock-pages.mjs --stream      # serve StreamFlix only
 *   node scripts/serve-mock-pages.mjs --youtube     # serve YouTube only
 *   node scripts/serve-mock-pages.mjs --build-only  # build + copy, no serve
 */

import { execSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist/mock-pages');
const TMP = resolve(ROOT, '.mock-servers');

const PAGES = [
  {
    name: 'StreamFlix',
    id: 'mock-streaming-page',
    port: 4321,
    distHtml: resolve(DIST, 'src/entrypoints/mock-streaming-page/index.html'),
    outDir: resolve(TMP, 'mock-streaming'),
  },
  {
    name: 'StreamFlixIframe',
    id: 'mock-streaming-iframe-page',
    port: 4323,
    distHtml: resolve(DIST, 'src/entrypoints/mock-streaming-iframe-page/index.html'),
    outDir: resolve(TMP, 'mock-streaming-iframe'),
  },
  {
    name: 'IframePlayer',
    id: 'mock-iframe-player',
    port: 4324,
    distHtml: resolve(DIST, 'src/entrypoints/mock-iframe-player/index.html'),
    outDir: resolve(TMP, 'mock-iframe-player'),
  },
  {
    name: 'YouTube',
    id: 'mock-youtube',
    port: 4322,
    distHtml: resolve(DIST, 'src/entrypoints/mock-youtube/index.html'),
    outDir: resolve(TMP, 'mock-youtube'),
  },
  {
    name: 'HardSub',
    id: 'mock-hardsub-page',
    port: 4325,
    distHtml: resolve(DIST, 'src/entrypoints/mock-hardsub-page/index.html'),
    outDir: resolve(TMP, 'mock-hardsub'),
  },
  {
    name: 'YouTubeHardsub',
    id: 'mock-youtube-hardsub',
    port: 4326,
    distHtml: resolve(DIST, 'src/entrypoints/mock-youtube-hardsub/index.html'),
    outDir: resolve(TMP, 'mock-youtube-hardsub'),
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
  rmSync(page.outDir, { recursive: true, force: true });
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
}

function servePage(page) {
  console.log(`\n▶ Serving ${page.name} at http://127.0.0.1:${page.port}/index.html`);
  // Use shell:true with cwd to serve "." from the output directory.
  // Shell is required on Windows for .cmd binaries like npx.cmd.
  const child = spawn(
    `npx --yes http-server . -p ${page.port} -a 127.0.0.1 --cors`,
    {
      stdio: 'inherit',
      cwd: page.outDir,
      shell: true,
    },
  );
  child.on('error', (err) => {
    console.error(`✗ ${page.name}: failed to start server: ${err.message}`);
  });
  return child;
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
  console.log(`  ${page.name}:  http://127.0.0.1:${page.port}/index.html`);
}
console.log('\n  Press Ctrl+C to stop all servers.\n');

// Keep process alive, kill all on exit
process.on('SIGINT', () => {
  console.log('\nStopping servers...');
  for (const s of servers) {
    try { s.kill('SIGTERM'); } catch {}
  }
  process.exit(0);
});
