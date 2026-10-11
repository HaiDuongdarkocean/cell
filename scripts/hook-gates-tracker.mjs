#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { loadState, PIPELINE_CLI, readPayload, ROOT } from './hook-pipeline-common.mjs';

const GATE_PATTERNS = [
  [/npm\s+run\s+typecheck/, 'typecheck'],
  [/npx\s+tsc\s+(--?noEmit|-noEmit)/, 'typecheck'],
  [/npm\s+run\s+lint/, 'lint'],
  [/npx\s+eslint/, 'lint'],
  [/npm\s+run\s+test:unit/, 'testUnit'],
  [/npx\s+vitest\s+run/, 'testUnit'],
  [/npm\s+run\s+build/, 'build'],
  [/npx\s+vite\s+build/, 'build'],
  [/playwright\s+test/, 'browser'],
  [/check-design-brief\.mjs/, 'briefLint'],
];

readPayload((payload) => {
  if (payload?.tool_name !== 'exec') process.exit(0);
  const state = loadState();
  const slug = state.active;
  const item = slug && state.items[slug];
  if (!item || item.stage !== 'deliver') process.exit(0);
  if (item.owner?.sessionId !== payload?.session_id) process.exit(0);

  const command = String(payload?.tool_input?.command || '');
  if (!command) process.exit(0);
  const success = payload?.tool_response?.success === true;

  const hits = GATE_PATTERNS.filter(([re]) => re.test(command)).map(([, g]) => g);
  if (!hits.length) process.exit(0);

  for (const gate of new Set(hits)) {
    spawnSync(process.execPath, [PIPELINE_CLI, 'gates', slug, '--set', `${gate}=${success ? 'pass' : 'fail'}`], {
      cwd: ROOT,
      stdio: 'ignore',
      timeout: 5000,
    });
  }
  process.exit(0);
});
