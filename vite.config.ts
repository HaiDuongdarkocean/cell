import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './public/manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // The CRX plugin handles the popup and background entries; add the
        // offscreen document explicitly so it is built and emitted as a
        // loadable chrome-extension:// page.
        offscreen: resolve(__dirname, 'src/offscreen/ffmpeg.html'),
      },
    },
  },
});
