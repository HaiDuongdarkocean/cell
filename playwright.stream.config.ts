import { defineConfig, devices } from '@playwright/test';
import { getE2EAgentPaths } from './e2e/lib/agent-paths';

const { testResults, playwrightReport } = getE2EAgentPaths();

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const workersEnv = process.env.PW_WORKERS
  ? parseInt(process.env.PW_WORKERS, 10)
  : undefined;

const streamPort = 4321 + portOffset;
const youtubePort = 4322 + portOffset;
// The mock pages hardcode the iframe child origin at 127.0.0.1:4324
// (streamFlixData.PLAYER_ORIGIN), so the cross-origin iframe servers cannot
// take the port offset — PW_PORT_OFFSET runs skip iframe coverage.
const iframePlayerPort = 4324;

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: 'e2e/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: workersEnv ?? 1,
  reporter: [['html', { outputFolder: playwrightReport }]],
  outputDir: testResults,
  globalSetup: './e2e/globalSetup.ts',
  globalTeardown: './e2e/globalTeardown.ts',
  timeout: 120_000,
  expect: { timeout: 30_000 },
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
    {
      command: 'node scripts/serve-mock-pages.mjs --stream-iframe --no-build',
      url: `http://127.0.0.1:${iframePlayerPort}/index.html`,
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
