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
const showcasePort = 8123 + portOffset;
const launcherPort = 8124 + portOffset;
const profilePanelPort = 5173 + portOffset;


export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: 'e2e/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}',
  // Extension tests share a worker-scoped persistent context, so tests inside
  // a file must stay sequential. Workers > 1 still parallelize across files.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: workersEnv ?? 1,
  reporter: [['html', { outputFolder: reportDir }]],
  timeout: 120_000, // 2 min per test (sites can be slow)
  expect: { timeout: 30_000 },
  outputDir,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `npx http-server dist/design-system-showcase -p ${showcasePort} -c-1 -d false`,
      url: `http://127.0.0.1:${showcasePort}/design-system-showcase.html`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
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
    {
      command: `node scripts/serve-test-pages.mjs --launcher`,
      url: `http://127.0.0.1:${launcherPort}/`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `node scripts/serve-test-pages.mjs --profile`,
      url: `http://127.0.0.1:${profilePanelPort}/`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
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
        baseURL: `http://127.0.0.1:${showcasePort}/design-system-showcase.html`,
      },
    },
    {
      name: 'launcher',
      testMatch: '**/launcher-dashboard*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${launcherPort}`,
      },
    },
    {
      name: 'profile-panel',
      testMatch: '**/profile-panel*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${profilePanelPort}`,
      },
    },
  ],
});
