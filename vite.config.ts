import { defineConfig, type Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import manifest from './public/manifest.json' with { type: 'json' };

/**
 * Auto-seed assets — copies the default dictionary + frequency files from
 * `tests/data-test/resource/` into `dist/seed/` during every `vite build`.
 * Only the 2 files referenced by SEED_FILES in devSeed.ts are copied (~42.7MB)
 * so the extension works out-of-the-box without requiring user import.
 * Extension fetches via `chrome.runtime.getURL('seed/...')` — same origin, no CSP needed.
 *
 * SSOT: the file list below MUST match SEED_FILES in src/features/dictionary/logic/devSeed.ts.
 */
const SEED_ASSET_FILES: readonly string[] = [
  'en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
  'en/frequency_list/standard.json',
] as const;

function autoSeedAssets(mode: string): Plugin {
  // Production builds should not ship test seed files (~42.7MB).
  // Dev builds (`npx vite build --mode development`) keep seeds so the
  // extension works out-of-the-box when loaded from `dist/`.
  if (mode !== 'development') return { name: 'auto-seed-assets' };
  const seedRoot = resolve(__dirname, 'tests', 'data-test', 'resource');
  return {
    name: 'auto-seed-assets',
    apply: 'build',
    closeBundle() {
      const destRoot = resolve(__dirname, 'dist', 'seed');
      try {
        for (const relPath of SEED_ASSET_FILES) {
          const src = resolve(seedRoot, relPath);
          const dest = resolve(destRoot, relPath);
          if (!existsSync(src)) {
            console.warn(`[auto-seed-assets] Seed file not found: ${src}`);
            continue;
          }
          mkdirSync(resolve(dest, '..'), { recursive: true });
          copyFileSync(src, dest);
        }
        console.log(`[auto-seed-assets] Copied ${SEED_ASSET_FILES.length} seed files to ${destRoot}`);
      } catch (err) {
        console.warn(`[auto-seed-assets] Failed to copy seed data:`, err);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [crx({ manifest }), autoSeedAssets(mode)],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // The CRX plugin handles the popup and background entries; add the
        // offscreen document and side panel explicitly so they are built
        // and emitted as loadable chrome-extension:// pages.
        offscreen: resolve(__dirname, 'src/entrypoints/offscreen/ffmpeg.html'),
        sidepanel: resolve(__dirname, 'src/entrypoints/sidepanel/index.html'),
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
}));
