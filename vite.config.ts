import { defineConfig, type Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import manifest from './public/manifest.json' with { type: 'json' };

/**
 * Auto-seed assets — copies the default dictionary + frequency files from
 * `data/resource/` into `dist/seed/` during every `vite build`.
 * Only the 2 files referenced by SEED_FILES in devSeed.ts are copied (~42.7MB)
 * so the extension works out-of-the-box without requiring user import.
 * Extension fetches via `chrome.runtime.getURL('seed/...')` — same origin, no CSP needed.
 *
 * SSOT: the file list below MUST match SEED_FILES in src/features/dictionary/logic/devSeed.ts.
 * Fallback to `tests/data-test/resource/` for environments that have not migrated to `data/` yet.
 */
const SEED_ASSET_FILES: readonly string[] = [
  'en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
  'en/frequency/standard.json',
] as const;

function designSystemShowcase(): Plugin {
  return {
    name: 'design-system-showcase',
    apply: 'build',
    closeBundle() {
      const distHtml = resolve(__dirname, 'dist', 'src', 'entrypoints', 'design-system-showcase', 'index.html');
      const distAssets = resolve(__dirname, 'dist', 'assets');
      const destDir = resolve(__dirname, 'docs', 'design-system');
      if (!existsSync(distHtml)) {
        console.warn('[design-system-showcase] dist/src/entrypoints/design-system-showcase/index.html not found');
        return;
      }
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

      const html = readFileSync(distHtml, 'utf8');
      const usedAssets = new Set<string>();

      const fixedHtml = html
        .replace(/\.\.\/\.\.\/assets\//g, 'assets/')
        .replace(/src="\/assets\/([^"]+)"/g, (_m, name) => {
          usedAssets.add(name);
          return `src="assets/${name}"`;
        })
        .replace(/href="\/assets\/([^"]+)"/g, (_m, name) => {
          usedAssets.add(name);
          return `href="assets/${name}"`;
        })
        .replace(/<link rel="modulepreload"[^>]*>\n?/g, '');

      writeFileSync(resolve(destDir, 'design-system-showcase.html'), fixedHtml);

      const destAssetsDir = resolve(destDir, 'assets');
      if (existsSync(destAssetsDir)) rmSync(destAssetsDir, { recursive: true, force: true });
      if (existsSync(distAssets) && usedAssets.size > 0) {
        mkdirSync(destAssetsDir, { recursive: true });
        for (const name of usedAssets) {
          const src = resolve(distAssets, name);
          const dest = resolve(destAssetsDir, name);
          if (existsSync(src)) copyFileSync(src, dest);
        }
        console.log(`[design-system-showcase] Copied ${usedAssets.size} assets to docs/design-system/assets`);
      }
      console.log('[design-system-showcase] Copied showcase to docs/design-system/design-system-showcase.html');
    },
  };
}

function autoSeedAssets(mode: string): Plugin {
  // Production builds should not ship test seed files (~42.7MB).
  // Dev builds (`npx vite build --mode development`) keep seeds so the
  // extension works out-of-the-box when loaded from `dist/`.
  if (mode !== 'development') return { name: 'auto-seed-assets' };
  const primaryRoot = resolve(__dirname, 'data', 'resource');
  const fallbackRoot = resolve(__dirname, 'tests', 'data-test', 'resource');
  const seedRoot = existsSync(primaryRoot) ? primaryRoot : fallbackRoot;
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
  plugins: [crx({ manifest }), autoSeedAssets(mode), designSystemShowcase()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite 8 defaults to lightningcss for CSS minification, which silently
    // strips valid CSS properties (overflow-y, overscroll-behavior, min-height)
    // from CSS modules — especially ?inline imports for shadow DOM injection.
    // esbuild preserves all properties. See vitejs/vite#22649.
    cssMinify: false,
    rollupOptions: {
      input: {
        // The CRX plugin handles the popup and background entries; add the
        // offscreen document and side panel explicitly so they are built
        // and emitted as loadable chrome-extension:// pages.
        offscreen: resolve(__dirname, 'src/entrypoints/offscreen/ffmpeg.html'),
        sidepanel: resolve(__dirname, 'src/entrypoints/sidepanel/index.html'),
        cardCreatorTest: resolve(__dirname, 'src/entrypoints/test/cardCreatorTest.html'),
        designSystemShowcase: resolve(__dirname, 'src/entrypoints/design-system-showcase/index.html'),
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
