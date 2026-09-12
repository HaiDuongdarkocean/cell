import { defineConfig, devices } from '@playwright/test';

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const outputSuffix = process.env.PW_OUTPUT_DIR || '';
const workersEnv = process.env.PW_WORKERS
  ? parseInt(process.env.PW_WORKERS, 10)
  : undefined;

const outputDir = outputSuffix ? `test-results-${outputSuffix}` : 'test-results';
const reportDir = outputSuffix
  ? `playwright-report-${outputSuffix}`
  : 'playwright-report';

const streamPort = 4321 + portOffset;
const youtubePort = 4322 + portOffset;

/**
 * Stream-specific Playwright config for the StreamFlix + Universal Panel E2E
 * suite. It only starts the mock YouTube and StreamFlix servers and runs the
 * extension + stage2 specs. Port, output and worker counts are isolated per
 * agent via PW_PORT_OFFSET, PW_OUTPUT_DIR and PW_WORKERS.
 */
export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: 'e2e/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: workersEnv ?? 1,
  reporter: [['html', { outputFolder: reportDir }]],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  outputDir,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/serve-mock-pages.mjs --youtube --no-build',
      url: `http://127.0.0.1:${youtubePort}/index.html`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/serve-mock-pages.mjs --stream --no-build',
      url: `http://127.0.0.1:${streamPort}/index.html`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: 'stage2',
      testMatch: ['**/extension*.spec.ts', '**/stage2/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: 'chrome://extensions' },
    },
  ],
});
