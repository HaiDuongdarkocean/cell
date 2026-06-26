import { test, expect, type Page } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Local static server for subtitle overlay test page + video + SRT file.
 * Serves files from tests/browser/ on a random localhost port.
 */
async function startStaticServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const root = resolve(__dirname, '../tests/browser');
  const server: Server = createServer(async (req, res) => {
    try {
      const path = req.url === '/' ? '/test-subtitle-overlay.html' : req.url ?? '';
      const filePath = resolve(root, '.' + path);
      const data = await readFile(filePath);
      const ext = path.endsWith('.html') ? 'text/html' : path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.srt') ? 'text/plain' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ext });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/**
 * Launch browser with extension loaded (same pattern as extension.ts fixture,
 * but inlined to avoid import complexity in this self-contained test).
 */
async function launchWithExtension(): Promise<{ page: Page; close: () => Promise<void> }> {
  const { chromium } = await import('@playwright/test');
  const pathToExtension = resolve(__dirname, '../dist');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // Wait for service worker
  const workers = context.serviceWorkers();
  if (workers.length === 0) {
    await context.waitForEvent('serviceworker', { timeout: 10_000 });
  }

  const page = await context.newPage();
  return {
    page,
    close: async () => { await context.close(); },
  };
}

test.describe('Subtitle Overlay', () => {
  test('overlay text is selectable (pointer-events: auto on span)', async () => {
    const server = await startStaticServer();
    const { page, close } = await launchWithExtension();

    try {
      await page.goto(`${server.url}/test-subtitle-overlay.html`, { waitUntil: 'domcontentloaded' });
      // Wait for extension content script to inject overlay
      await page.waitForTimeout(2000);

      // Load subtitle via drag-drop simulation + trigger display
      await page.evaluate(async () => {
        const v = document.querySelector('video')!;
        // Wait for video metadata to load
        if (v.readyState < 1) {
          await new Promise<void>((r) => { v.addEventListener('loadedmetadata', () => r(), { once: true }); });
        }
        const srt = '1\n00:00:00,500 --> 00:00:02,000\nHello world!\n';
        const file = new File([srt], 'test.srt', { type: 'text/plain' });
        const dt = new DataTransfer();
        dt.items.add(file);
        v.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
        // Wait for parse then trigger timeupdate to show overlay
        await new Promise(r => setTimeout(r, 500));
        v.currentTime = 1;
        v.dispatchEvent(new Event('timeupdate'));
      });
      await page.waitForTimeout(500);

      // Verify overlay exists and is visible (display: block after timeupdate)
      const overlay = page.locator('[data-testid="subtitle-overlay"]');
      await expect(overlay).toBeVisible();

      // Verify inner span exists with correct text
      const span = overlay.locator('span');
      await expect(span).toHaveText('Hello world!');

      // Verify pointer-events split: container none, span auto
      const containerPointerEvents = await overlay.evaluate((el) => getComputedStyle(el).pointerEvents);
      expect(containerPointerEvents).toBe('none');

      const spanPointerEvents = await span.evaluate((el) => getComputedStyle(el).pointerEvents);
      expect(spanPointerEvents).toBe('auto');

      const spanUserSelect = await span.evaluate((el) => getComputedStyle(el).userSelect);
      expect(spanUserSelect).toBe('text');

      const spanCursor = await span.evaluate((el) => getComputedStyle(el).cursor);
      expect(spanCursor).toBe('text');
    } finally {
      await close();
      await server.close();
    }
  });

  test('click on overlay background passes through to video', async () => {
    const server = await startStaticServer();
    const { page, close } = await launchWithExtension();

    try {
      await page.goto(`${server.url}/test-subtitle-overlay.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Load subtitle + trigger display
      await page.evaluate(async () => {
        const v = document.querySelector('video')!;
        if (v.readyState < 1) {
          await new Promise<void>((r) => { v.addEventListener('loadedmetadata', () => r(), { once: true }); });
        }
        const srt = '1\n00:00:00,500 --> 00:00:02,000\nHello world!\n';
        const file = new File([srt], 'test.srt', { type: 'text/plain' });
        const dt = new DataTransfer();
        dt.items.add(file);
        v.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        v.currentTime = 1;
        v.dispatchEvent(new Event('timeupdate'));
      });
      await page.waitForTimeout(500);

      // Verify overlay is visible first
      const overlay = page.locator('[data-testid="subtitle-overlay"]');
      await expect(overlay).toBeVisible();

      // Click on overlay padding area (not on span text) → should hit video
      const elementAtPadding = await page.evaluate(() => {
        const overlay = document.querySelector('[data-testid="subtitle-overlay"]') as HTMLElement;
        const span = overlay.querySelector('span') as HTMLElement;
        const overlayRect = overlay.getBoundingClientRect();
        const spanRect = span.getBoundingClientRect();
        // Find a point in overlay padding (above span, inside overlay)
        const paddingX = overlayRect.left + 4;
        const paddingY = overlayRect.top + 2;
        // If padding point is inside span, use overlay edge instead
        const testX = (paddingX >= spanRect.left && paddingX <= spanRect.right) ? overlayRect.left + 2 : paddingX;
        const testY = (paddingY >= spanRect.top && paddingY <= spanRect.bottom) ? overlayRect.top + 2 : paddingY;
        const el = document.elementFromPoint(testX, testY);
        return { tag: el?.tagName, testX, testY };
      });
      expect(elementAtPadding.tag).toBe('VIDEO');
    } finally {
      await close();
      await server.close();
    }
  });

  test('import button exists and has file input', async () => {
    const server = await startStaticServer();
    const { page, close } = await launchWithExtension();

    try {
      await page.goto(`${server.url}/test-subtitle-overlay.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const importButton = page.locator('[data-testid="subtitle-import-button"]');
      await expect(importButton).toBeVisible();

      const fileInput = importButton.locator('input[type="file"]');
      await expect(fileInput).toHaveAttribute('accept', '.srt,.vtt,.ass,.ssa');
    } finally {
      await close();
      await server.close();
    }
  });

  test('drag hint shows on dragenter and hides on drop', async () => {
    const server = await startStaticServer();
    const { page, close } = await launchWithExtension();

    try {
      await page.goto(`${server.url}/test-subtitle-overlay.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const dragHint = page.locator('[data-testid="subtitle-drag-hint"]');
      // Initially hidden
      await expect(dragHint).toBeHidden();

      // Simulate dragenter
      await page.evaluate(() => {
        const v = document.querySelector('video')!;
        v.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
      });
      await expect(dragHint).toBeVisible();

      // Simulate drop
      await page.evaluate(() => {
        const v = document.querySelector('video')!;
        const dt = new DataTransfer();
        v.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      });
      await expect(dragHint).toBeHidden();
    } finally {
      await close();
      await server.close();
    }
  });
});
