/**
 * Local HTTP server fixture for deterministic M3U8 E2E tests.
 *
 * Serves a small HLS playlist with N fake .ts segments from a random localhost
 * port. No external network dependency — the test is fully deterministic.
 *
 * Usage:
 *   const server = await startLocalM3u8Server({ segments: 3 });
 *   // server.url → 'http://localhost:PORT/'
 *   // server.playlistUrl → 'http://localhost:PORT/playlist.m3u8'
 *   await server.close();
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface LocalM3u8Server {
  url: string;
  playlistUrl: string;
  close: () => Promise<void>;
}

export interface LocalM3u8ServerOptions {
  /** Number of fake .ts segments to serve (default: 3). */
  segments?: number;
  /** Size of each fake segment in bytes (default: 1024). */
  segmentSize?: number;
}

const PLAYLIST_PATH = '/playlist.m3u8';

/**
 * Start a local HTTP server that serves a deterministic M3U8 playlist + fake
 * .ts segments. Returns the server handle with URLs.
 */
export function startLocalM3u8Server(
  options: LocalM3u8ServerOptions = {},
): Promise<LocalM3u8Server> {
  const segmentCount = options.segments ?? 3;
  const segmentSize = options.segmentSize ?? 1024;

  return new Promise((resolve, reject) => {
    // These are assigned in the listen callback before any request arrives.
    let base = '';

    const server = createServer((req, res) => {
      const url = req.url ?? '/';

      if (url === '/' || url === '/index.html') {
        // Serve a minimal HTML page that references the m3u8 via a <video>
        // tag (so the network interceptor can detect it).
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          `<!DOCTYPE html><html><body>` +
            `<video src="${PLAYLIST_PATH}" controls></video>` +
            `</body></html>`,
        );
        return;
      }

      if (url === PLAYLIST_PATH) {
        // Build the playlist with absolute URLs.
        const lines: string[] = [
          '#EXTM3U',
          '#EXT-X-VERSION:3',
          '#EXT-X-TARGETDURATION:10',
        ];
        for (let i = 0; i < segmentCount; i++) {
          lines.push('#EXTINF:10.0,');
          lines.push(`${base}/seg${i}.ts`);
        }
        lines.push('#EXT-X-ENDLIST');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
        });
        res.end(lines.join('\n'));
        return;
      }

      // Serve fake .ts segments.
      const segMatch = url.match(/^\/seg(\d+)\.ts$/);
      if (segMatch) {
        const buf = Buffer.alloc(segmentSize, 0x47); // 0x47 = MPEG-TS sync byte
        res.writeHead(200, {
          'Content-Type': 'video/mp2t',
          'Content-Length': segmentSize.toString(),
        });
        res.end(buf);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      base = `http://127.0.0.1:${port}`;

      resolve({
        url: base,
        playlistUrl: `${base}${PLAYLIST_PATH}`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
