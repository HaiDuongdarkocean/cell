import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { resolve } from 'node:path';
import { readFileSync, cpSync, rmSync } from 'node:fs';

const SHOWCASE_HTML_PATH = resolve(
  __dirname,
  'src/entrypoints/design-system-showcase/index.html',
);

/**
 * SPA rewrite cho /showcase/<title> → serve showcase index.html.
 * Browser giữ URL /showcase/<title> (ShowcaseGallery đọc pathname),
 * Vite transformIndexHtml inject script với base đúng (/src/entrypoints/design-system-showcase/).
 */
/**
 * Move build output từ `dist/design-system-showcase/src/entrypoints/design-system-showcase/index.html`
 * sang `dist/design-system-showcase/design-system-showcase.html` để `npm run design-system` serve
 * artifact mới nhất từ root.
 */
const showcaseOutputMover = (): Plugin => ({
  name: 'showcase-output-mover',
  apply: 'build',
  closeBundle() {
    const outDir = resolve(__dirname, 'dist/design-system-showcase');
    const deep = resolve(outDir, 'src/entrypoints/design-system-showcase/index.html');
    const flat = resolve(outDir, 'design-system-showcase.html');
    try {
      cpSync(deep, flat, { force: true, recursive: false });
      rmSync(resolve(outDir, 'src'), { force: true, recursive: true });
    } catch {
      // Ignore nếu artifact đã được xử lý.
    }
  },
});

const showcaseSpaRewrite = (): Plugin => ({
  name: 'showcase-spa-rewrite',
  configureServer(server: ViteDevServer) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? '';
      if (!url.startsWith('/showcase/')) return next();
      try {
        const raw = readFileSync(SHOWCASE_HTML_PATH, 'utf-8');
        const transformed = await server.transformIndexHtml(url, raw);
        // Rewrite relative script src → absolute để resolve đúng từ /showcase/<title>
        const fixed = transformed.replace(
          /src="\.\/main\.tsx/g,
          'src="/src/entrypoints/design-system-showcase/main.tsx',
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(fixed);
      } catch (err) {
        next(err);
      }
    });
  },
});

/**
 * Vite config riêng cho Design System Showcase dev server và build.
 * Không load CRXJS → không interfere với extension.
 * Build outputs `dist/design-system-showcase/design-system-showcase.html`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    entries: ['src/entrypoints/design-system-showcase/index.html'],
  },
  plugins: [showcaseSpaRewrite(), showcaseOutputMover()],
  server: {
    port: 5180,
    strictPort: true,
    open: '/src/entrypoints/design-system-showcase/index.html',
  },
  build: {
    outDir: 'dist/design-system-showcase',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'design-system-showcase': SHOWCASE_HTML_PATH,
      },
    },
  },
});
