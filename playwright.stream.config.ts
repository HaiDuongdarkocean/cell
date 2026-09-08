import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal Playwright config for the StreamFlix + Universal Panel E2E test.
 * Only starts the mock YouTube and StreamFlix servers (both from
 * `scripts/serve-mock-pages.mjs`) so the test can open a real Chromium
 * browser quickly without waiting for the full design-system / launcher
 * webServer fleet.
 */
export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: 'e2e/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  outputDir: 'test-results/',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/serve-mock-pages.mjs --youtube --no-build',
      url: 'http://127.0.0.1:4322/index.html',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node scripts/serve-mock-pages.mjs --stream --no-build',
      url: 'http://127.0.0.1:4321/index.html',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testMatch: ['**/extension*.spec.ts', '**/stage2/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: 'chrome://extensions' },
    },
  ],
});
