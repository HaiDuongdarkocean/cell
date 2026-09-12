#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { createServer } from 'http-server';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'build/showcase');

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const BASE_PORT = 8123;
const port = BASE_PORT + portOffset;

if (!existsSync(OUT_DIR)) {
  console.error(`✗ Design system build not found at ${OUT_DIR}`);
  console.error('  Run "npm run build:design-system" first.');
  process.exit(1);
}

const server = createServer({
  root: OUT_DIR,
  cors: true,
  cache: -1,
  showDir: false,
  autoIndex: true,
  logFn: (req, res) => {
    if (res.statusCode >= 400) {
      console.error(`[design-system] ${res.statusCode} ${req.url}`);
    }
  },
});

server.server.on('error', (err) => {
  console.error(`✗ Design system server error: ${err.message}`);
  process.exit(1);
});

server.listen(port, '127.0.0.1');
console.log(`▶ Serving design system at http://127.0.0.1:${port}/design-system-showcase.html`);

process.on('SIGINT', () => {
  try { server.close(); } catch {}
  process.exit(0);
});
