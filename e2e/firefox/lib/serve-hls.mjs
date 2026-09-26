import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'fixtures', 'hls');
const mime = { '.m3u8': 'application/x-mpegURL', '.ts': 'video/mp2t', '.html': 'text/html' };

const index = `<!doctype html><title>hls-fixture</title>
<video src="/playlist.m3u8" muted autoplay></video>
<script>fetch('/playlist.m3u8').catch(()=>{});</script>`;

export function serveHlsFixture() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(index);
      }
      try {
        const data = await readFile(join(root, url.pathname));
        res.writeHead(200, {
          'content-type': mime[extname(url.pathname)] ?? 'application/octet-stream',
          'access-control-allow-origin': '*',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
