import { rmSync } from 'node:fs';
import { getE2EAgentPaths } from './lib/agent-paths';

function safeRm(path: string) {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // Ignore permission errors from stale server locks.
  }
}

export default function globalTeardown() {
  const { staging, testResults, playwrightReport } = getE2EAgentPaths();
  if (process.env.PW_KEEP_STAGING !== '1') {
    safeRm(staging);
  }
  if (process.env.PW_KEEP_RESULTS !== '1') {
    rmSync(testResults, { recursive: true, force: true });
    rmSync(playwrightReport, { recursive: true, force: true });
  }
}
