import { defineConfig } from 'vite';
import { resolve } from 'node:path';

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
  server: {
    port: 5180,
    strictPort: true,
    open: '/src/entrypoints/design-system-showcase/index.html',
  },
});
