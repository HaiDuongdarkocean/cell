import { defineConfig, type Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
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
  const primaryRoot = resolve(import.meta.dirname, 'data', 'resource');
  const fallbackRoot = resolve(import.meta.dirname, 'tests', 'data-test', 'resource');
  const seedRoot = existsSync(primaryRoot) ? primaryRoot : fallbackRoot;
  return {
    name: 'auto-seed-assets',
    apply: 'build',
    closeBundle() {
      const destRoot = resolve(import.meta.dirname, 'dist', 'seed');
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
  plugins: [crx({ manifest }), hoverOnlyOnHoverDevices(), autoSeedAssets(mode)],
  // Rolldown (Vite 8) changed default CJS interop. React is CJS and has no
  // `__esModule` / default export, so `import React from 'react'` used by
  // zustand can resolve to an incorrect named export without this legacy flag.
  legacy: { inconsistentCjsInterop: true },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
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
        offscreen: resolve(import.meta.dirname, 'src/entrypoints/offscreen/ffmpeg.html'),
        sidepanel: resolve(import.meta.dirname, 'src/entrypoints/sidepanel/index.html'),
        cardCreatorTest: resolve(import.meta.dirname, 'src/entrypoints/test/cardCreatorTest.html'),
        mockStreamingPage: resolve(import.meta.dirname, 'src/entrypoints/mock-streaming-page/index.html'),
        mockStreamingIframePage: resolve(import.meta.dirname, 'src/entrypoints/mock-streaming-iframe-page/index.html'),
        mockIframePlayer: resolve(import.meta.dirname, 'src/entrypoints/mock-iframe-player/index.html'),
        mockYouTube: resolve(import.meta.dirname, 'src/entrypoints/mock-youtube/index.html'),
        mockHardSubPage: resolve(import.meta.dirname, 'src/entrypoints/mock-hardsub-page/index.html'),
        mockYouTubeHardsub: resolve(import.meta.dirname, 'src/entrypoints/mock-youtube-hardsub/index.html'),
        localPlayer: resolve(import.meta.dirname, 'src/entrypoints/local-player/index.html'),
        reader: resolve(import.meta.dirname, 'src/entrypoints/reader/index.html'),
        mockupLanguageProfile: resolve(import.meta.dirname, 'src/entrypoints/mockup-language-profile/index.html'),
        mockupAudio: resolve(import.meta.dirname, 'src/entrypoints/mockup-audio/index.html'),
        mockupDictionaryPopup: resolve(import.meta.dirname, 'src/entrypoints/mockup-dictionary-popup/index.html'),
        mockupResources: resolve(import.meta.dirname, 'src/entrypoints/mockup-resources/index.html'),
        launcherDashboard: resolve(import.meta.dirname, 'src/entrypoints/launcher-dashboard/index.html'),
        srsStudy: resolve(import.meta.dirname, 'src/entrypoints/srs-study/index.html'),
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
