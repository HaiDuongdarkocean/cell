import { defineConfig, type Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import manifest from './public/manifest.json' with { type: 'json' };

/**
 * Dev-only seed assets — serves test dictionary + frequency files from
 * `tests/data-test/resource/` at `/seed/<lang>/<relPath>` during `vite` dev.
 * Production build does NOT include these (43MB Cambridge file stays out of bundle).
 * Extension fetches via `http://localhost:5173/seed/...` (host_permissions: <all_urls>).
 */
function devSeedAssets(): Plugin {
  const seedRoot = resolve(__dirname, 'tests', 'data-test', 'resource');
  return {
    name: 'dev-seed-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/seed/')) return next();
        // /seed/en/dictionary/foo.json → tests/data-test/resource/en/dictionary/foo.json
        const relPath = decodeURIComponent(url.slice('/seed/'.length).split('?')[0]!);
        const fullPath = resolve(seedRoot, relPath);
        // Prevent path traversal outside seedRoot
        if (!fullPath.startsWith(seedRoot)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!existsSync(fullPath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        try {
          const data = readFileSync(fullPath);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(data);
        } catch {
          res.statusCode = 500;
          res.end('Read error');
        }
      });
    },
  };
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
