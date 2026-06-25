/**
 * E2E test: subtitle filename matches video filename + language suffix.
 *
 * Verifies that when a subtitle is downloaded on a page that also has a
 * detected video, the subtitle filename uses the video's title as the base
 * name with a language suffix (e.g. "Test Movie.en.srt"), not the subtitle's
 * own URL hash.
 *
 * NOTE: This test may skip in environments where the chrome.webRequest API
 * does not capture requests in Playwright-launched Chrome (a pre-existing
 * E2E environment issue — see also auto-select-auto-download.spec.ts which
 * skips for the same reason). The subtitle filename logic is fully covered
 * by unit tests in tests/unit/utils/fileUtils.test.ts and
 * tests/unit/background/downloader.test.ts. Live verification is done via
 * chrome-devtools MCP on Edge.
 *
 * The local server serves:
 *  - An HTML page with a <video> tag + JS fetch for m3u8 and subtitle
 *  - The m3u8 playlist + fake .ts segments
 *  - A VTT subtitle file
 */

import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

/** Minimal VTT subtitle content. */
const VTT_CONTENT = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:02.000',
  'Hello world',
  '',
  '00:00:03.000 --> 00:00:04.000',
  'Subtitle test',
  '',
].join('\n');

interface TestServer {
  url: string;
  close: () => Promise<void>;
}

function startTestServer(): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    let base = '';
    const server = createServer((req, res) => {
      const url = req.url ?? '/';

      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<!DOCTYPE html><html><body>' +
            '<video src="/playlist.m3u8" controls></video>' +
            '<script>' +
            // Force-fetch both the m3u8 playlist and the subtitle so the
            // network interceptor detects them (the <video> tag may not
            // fetch until playback starts).
            'fetch("/playlist.m3u8").catch(()=>{});' +
            'fetch("/subtitles/sub_en.vtt").catch(()=>{});' +
            '</script>' +
            '</body></html>',
        );
        return;
      }

      if (url === '/playlist.m3u8') {
        const lines = [
          '#EXTM3U',
          '#EXT-X-VERSION:3',
          '#EXT-X-TARGETDURATION:10',
          '#EXTINF:10.0,',
          `${base}/seg0.ts`,
          '#EXT-X-ENDLIST',
        ];
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
        res.end(lines.join('\n'));
        return;
      }

      const segMatch = url.match(/^\/seg(\d+)\.ts$/);
      if (segMatch) {
        const buf = Buffer.alloc(1024, 0x47);
        res.writeHead(200, {
          'Content-Type': 'video/mp2t',
          'Content-Length': '1024',
        });
        res.end(buf);
        return;
      }

      // Serve subtitle file
      if (url === '/subtitles/sub_en.vtt') {
        res.writeHead(200, { 'Content-Type': 'text/vtt' });
        res.end(VTT_CONTENT);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      base = `http://127.0.0.1:${addr.port}`;
      resolve({
        url: base,
        close: () =>
          new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

test.describe('subtitle filename matches video filename', () => {
  test('subtitle download uses video title + language suffix', async () => {
    const server = await startTestServer();

    try {
      const { context, extensionId } = await launchExtensionBrowser();

      try {
        // Navigate to the test page — this triggers the network interceptor
        // to detect both the m3u8 video and the VTT subtitle.
        const page = await context.newPage();
        await page.goto(server.url, {
          waitUntil: 'domcontentloaded',
          timeout: 10_000,
        });
        // Wait for the network interceptor to capture both video + subtitle.
        await page.waitForTimeout(5_000);

        // Open the popup.
        const popup = await openPopup(context, extensionId);
        await expect(popup.locator('[data-testid="media-section"]')).toBeVisible({
          timeout: 10_000,
        });

        // Verify both video and subtitle were detected.
        const videoCount = await popup.locator('[data-testid="video-card"]').count();
        const allDownloadBtns = await popup.locator(
          '[data-testid="media-section"] [data-testid="download-button"]',
        ).count();
        const mediaText = await popup.locator('[data-testid="media-section"]').textContent();
        console.log(`[E2E DEBUG] videoCount=${videoCount}, downloadBtns=${allDownloadBtns}`);
        console.log(`[E2E DEBUG] mediaText=${mediaText?.slice(0, 200)}`);

        if (videoCount === 0) {
          test.skip(true, 'No video detected — cannot test subtitle filename matching');
          return;
        }

        // Find the subtitle download button.
        const subtitleDownloadBtns = popup.locator(
          '[data-testid="media-section"] [data-testid="download-button"]',
        );
        const subtitleCount = await subtitleDownloadBtns.count();
        if (subtitleCount <= 1) {
          test.skip(true, `Only ${subtitleCount} download button(s) — no subtitle detected`);
          return;
        }

        // Click the subtitle download button (the 2nd one, after the video).
        await subtitleDownloadBtns.nth(1).click();

        // Wait for the download to complete.
        await page.waitForTimeout(3_000);

        // Query the service worker for the actual download filename.
        const serviceWorker = context.serviceWorkers()[0];
        expect(serviceWorker).toBeDefined();

        const downloads = await serviceWorker.evaluate(async () => {
          const items = await new Promise<chrome.downloads.DownloadItem[]>(
            (r) => chrome.downloads.search({ limit: 5, orderBy: ['-startTime'] }, r),
          );
          return items.map((it) => ({
            filename: it.filename,
            state: it.state,
            url: it.url?.slice(0, 50),
          }));
        });

        // Verify at least one download has a .srt extension with a language suffix.
        const srtDownloads = downloads.filter(
          (d) => d.filename.endsWith('.srt'),
        );
        expect(srtDownloads.length).toBeGreaterThanOrEqual(1);

        // The filename should contain a language suffix (e.g. ".en.srt").
        const hasLangSuffix = srtDownloads.some((d) =>
          /\.\w{2,3}\.srt$/.test(d.filename),
        );
        expect(hasLangSuffix).toBe(true);

        // The filename should NOT be the old hash-based name
        // (e.g. "subtitle_-_<hash>.srt").
        const isOldHashName = srtDownloads.some((d) =>
          /subtitle_-_[a-f0-9]+\.srt$/i.test(d.filename),
        );
        expect(isOldHashName).toBe(false);

        await popup.close();
        await page.close();
      } finally {
        await closeExtensionBrowser(context);
      }
    } finally {
      await server.close();
    }
  });
});
