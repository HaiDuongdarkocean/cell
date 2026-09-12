import { defineConfig, devices } from '@playwright/test';
import { getE2EAgentPaths } from './e2e/lib/agent-paths';

const { testResults, playwrightReport } = getE2EAgentPaths();

const portOffset = parseInt(process.env.PW_PORT_OFFSET || '0', 10);
const workersEnv = process.env.PW_WORKERS
  ? parseInt(process.env.PW_WORKERS, 10)
  : undefined;

const streamPort = 4321 + portOffset;
const youtubePort = 4322 + portOffset;
const showcasePort = 8123 + portOffset;
const launcherPort = 8124 + portOffset;
const profilePanelPort = 5173 + portOffset;

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
      command: `node scripts/serve-design-system.mjs`,
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
