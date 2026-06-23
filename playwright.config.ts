import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Extensions need sequential browser launches
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker — each test launches its own browser with extension
  reporter: 'html',
  timeout: 120_000, // 2 min per test (sites can be slow)
  expect: { timeout: 30_000 },
  use: {
    baseURL: 'chrome://extensions',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
