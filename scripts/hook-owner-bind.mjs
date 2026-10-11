#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { loadState, PIPELINE_CLI, readPayload, ROOT } from './hook-pipeline-common.mjs';

// Binds the executing session to a pipeline owner: a command running
// `pipeline-state.mjs ... --owner <id>` where <id> already owns an item is an
// explicit identity claim from the owner session. Everything without --owner
// runs as the `human` override, which proves nothing — so it never binds.
readPayload((payload) => {
  if (payload?.tool_name !== 'exec' || payload?.tool_response?.success !== true) process.exit(0);
  const sid = payload?.session_id;
  if (!sid) process.exit(0);
  const command = String(payload?.tool_input?.command || '');
  if (!command.includes('pipeline-state.mjs')) process.exit(0);
  const ownerMatch = command.match(/--owner\s+(\S+)/);
  if (!ownerMatch) process.exit(0);

  const state = loadState();
  for (const [slug, item] of Object.entries(state.items)) {
    if (item?.owner?.id === ownerMatch[1] && item.owner.sessionId !== sid) {
      spawnSync(process.execPath, [PIPELINE_CLI, 'bind', slug, '--session', sid], {
        cwd: ROOT,
        stdio: 'ignore',
        timeout: 5000,
      });
    }
  }
  process.exit(0);
});
