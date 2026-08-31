import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  configFile: false,
  root: resolve(import.meta.dirname, 'src/entrypoints/test'),
  server: {
    port: 5174,
    host: '127.0.0.1',
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
});
