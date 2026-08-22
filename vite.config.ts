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

/**
 * Wrap every `:hover` CSS rule in `@media (hover: hover)` at build time.
 *
 * On touch devices, browsers keep a simulated `:hover` state after tap — the
 * hover background "sticks" and doesn't disappear, which clashes with the
 * product's own `:active` feedback. `@media (hover: hover)` gates hover styles
 * to devices that have a real hover input (mouse/trackpad), so touch devices
 * never trigger them.
 *
 * The transform runs at build time on raw CSS (before Vite's CSS-module
 * hashing), so it covers every surface: React pages, Shadow DOM `?raw`
 * imports, and `?inline` CSS modules. No source files are changed.
 *
 * The codebase uses flat CSS (no native nesting), so every `:hover` rule is
 * `selector:hover { body }` with no nested braces — a single regex pass is
 * safe and complete. Rules already inside `@media (hover: hover)` are
 * extracted first and reinserted to avoid double-wrapping.
 */
function hoverOnlyOnHoverDevices(): Plugin {
  return {
    name: 'hover-only-on-hover-devices',
    enforce: 'pre',
    // Process ?raw / ?inline CSS imports (they become string literals in JS,
    // so generateBundle never sees them as CSS assets).
    transform(code, id) {
      if (!id.includes('.css') || !code.includes(':hover')) return null;
      const wrapped = wrapHoverRules(code);
      return wrapped === code ? null : { code: wrapped, map: null };
    },
    // Process final CSS assets — catches @imported files whose :hover was
    // not visible during transform (Vite resolves @import after enforce:pre).
    generateBundle(_opts, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'asset' || !chunk.fileName.endsWith('.css')) continue;
        const src = typeof chunk.source === 'string' ? chunk.source : null;
        if (!src || !src.includes(':hover')) continue;
        const wrapped = wrapHoverRules(src);
        if (wrapped !== src) chunk.source = wrapped;
      }
    },
  };
}

/** Extract @media (hover: hover) blocks, wrap remaining :hover rules, restore. */
function wrapHoverRules(css: string): string {
  const HOVER_MEDIA_RE = /@media\s*\(\s*hover:\s*hover\s*\)\s*\{/g;
  const saved: string[] = [];
  const spans: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = HOVER_MEDIA_RE.exec(css)) !== null) {
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    spans.push({ start: m.index, end: j });
  }
  let out = css;
  for (let i = spans.length - 1; i >= 0; i--) {
    saved.push(css.slice(spans[i].start, spans[i].end));
    out = out.slice(0, spans[i].start) + `/*__HOVER_MEDIA_${saved.length - 1}__*/` + out.slice(spans[i].end);
  }
  // Flat CSS (no nesting): selector:hover { body } — no braces inside selector or body.
  out = out.replace(/([^{}]*:hover[^{}]*)\{([^{}]*)\}/g, '@media (hover: hover){$1{$2}}');
  for (let i = 0; i < saved.length; i++) {
    out = out.replace(`/*__HOVER_MEDIA_${i}__*/`, saved[i]);
  }
  return out;
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
  plugins: [crx({ manifest }), hoverOnlyOnHoverDevices(), autoSeedAssets(mode), designSystemShowcase()],
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
        mockStreamingPage: resolve(__dirname, 'src/entrypoints/mock-streaming-page/index.html'),
        mockStreamingIframePage: resolve(__dirname, 'src/entrypoints/mock-streaming-iframe-page/index.html'),
        mockIframePlayer: resolve(__dirname, 'src/entrypoints/mock-iframe-player/index.html'),
        mockYouTube: resolve(__dirname, 'src/entrypoints/mock-youtube/index.html'),
        mockHardSubPage: resolve(__dirname, 'src/entrypoints/mock-hardsub-page/index.html'),
        mockYouTubeHardsub: resolve(__dirname, 'src/entrypoints/mock-youtube-hardsub/index.html'),
        localPlayer: resolve(__dirname, 'src/entrypoints/local-player/index.html'),
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
