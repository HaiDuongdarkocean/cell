import { defineConfig, type Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import manifest from './public/manifest.json' with { type: 'json' };

/**
 * Dev-only seed assets — copies test dictionary + frequency files from
 * `tests/data-test/resource/` into `dist/seed/` during `vite build --mode development`.
 * Production build does NOT copy (43MB Cambridge stays out of bundle).
 * Extension fetches via `chrome.runtime.getURL('seed/...')` — same origin, no CSP needed.
 */
function devSeedAssets(): Plugin {
  const seedRoot = resolve(__dirname, 'tests', 'data-test', 'resource');
  let buildMode = 'production';
  return {
    name: 'dev-seed-assets',
    apply: 'build',
    configResolved(config) {
      buildMode = config.mode;
    },
    closeBundle() {
      if (buildMode === 'production') return;
      const destRoot = resolve(__dirname, 'dist', 'seed');
      if (!existsSync(seedRoot)) return;
      try {
        copyDirRecursive(seedRoot, destRoot);
        console.log(`[dev-seed-assets] Copied seed data to ${destRoot} (mode=${buildMode})`);
      } catch (err) {
        console.warn(`[dev-seed-assets] Failed to copy seed data:`, err);
      }
    },
  };
}

/** Recursively copy a directory. */
function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  plugins: [crx({ manifest }), devSeedAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // The CRX plugin handles the popup and background entries; add the
        // offscreen document, side panel, and options page explicitly so they
        // are built and emitted as loadable chrome-extension:// pages.
        offscreen: resolve(__dirname, 'src/entrypoints/offscreen/ffmpeg.html'),
        sidepanel: resolve(__dirname, 'src/entrypoints/sidepanel/index.html'),
        options: resolve(__dirname, 'src/entrypoints/options/index.html'),
        cardCreatorTest: resolve(__dirname, 'src/entrypoints/test/cardCreatorTest.html'),
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
