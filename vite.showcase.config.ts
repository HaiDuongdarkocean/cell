import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const SHOWCASE_HTML_PATH = resolve(
  __dirname,
  'src/entrypoints/design-system-showcase/index.html',
);

/**
 * SPA rewrite cho /showcase/<title> → serve showcase index.html.
 * Browser giữ URL /showcase/<title> (ShowcaseGallery đọc pathname),
 * Vite transformIndexHtml inject script với base đúng (/src/entrypoints/design-system-showcase/).
 */
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
 * Vite config riêng cho Design System Showcase dev server.
 * Không load CRXJS → không interfere với extension.
 * Chỉ serve showcase HTML + HMR cho component iteration.
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
  plugins: [showcaseSpaRewrite()],
  server: {
    port: 5180,
    strictPort: true,
    open: '/src/entrypoints/design-system-showcase/index.html',
  },
});
