import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

function getE2EAgentName(): string {
  const raw = (process.env.PW_OUTPUT_DIR || '').trim();
  if (!raw) return 'default';
  if (/^[a-zA-Z0-9_-]+$/.test(raw) && raw !== '.' && raw !== '..') return raw;
  throw new Error(`Invalid PW_OUTPUT_DIR: ${raw}`);
}

export function getE2EAgentPaths() {
  const agentName = getE2EAgentName();
  const agentRoot = resolve(projectRoot, 'e2e-results', agentName);
  return {
    projectRoot,
    agentRoot,
    agentName,
    staging: resolve(agentRoot, 'staging'),
    testResults: resolve(agentRoot, 'test-results'),
    playwrightReport: resolve(agentRoot, 'playwright-report'),
  };
}
