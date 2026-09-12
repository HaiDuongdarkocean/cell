import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Build standalone non-extension pages used by Playwright E2E tests.
 *
 * These pages are plain React apps (no chrome.* APIs, no CRXJS) so they can
 * be served with a static http-server. Keeping them separate from the main
 * `dist/` extension build prevents a Vite dev server from overwriting the
 * extension bundle with CRXJS loading pages while tests are running.
 */
const PAGES = {
  'src/entrypoints/launcher-dashboard/index.html': resolve(
    import.meta.dirname,
    'src/entrypoints/launcher-dashboard/index.html',
  ),
  'src/entrypoints/mockup-language-profile/index.html': resolve(
    import.meta.dirname,
    'src/entrypoints/mockup-language-profile/index.html',
  ),
};

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-pages',
    emptyOutDir: true,
    rollupOptions: {
      input: PAGES,
    },
  },
});
