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
  outputDir: 'test-results/',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'npm run build:design-system && npx http-server dist/design-system-showcase -p 8123 -c-1 -d false -P http://localhost:8123/design-system-showcase.html',
    url: 'http://localhost:8123/design-system-showcase.html',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: '**/extension*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'chrome://extensions' },
    },
    {
      name: 'showcase',
      testMatch: '**/showcase*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:8123/design-system-showcase.html',
      },
    },
  ],
});
