import { rmSync } from 'node:fs';
import { getE2EAgentPaths } from './lib/agent-paths';

export default function globalSetup() {
  const { testResults, playwrightReport } = getE2EAgentPaths();
  if (process.env.PW_KEEP_RESULTS !== '1') {
    rmSync(testResults, { recursive: true, force: true });
    rmSync(playwrightReport, { recursive: true, force: true });
  }
}
