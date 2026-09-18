#!/usr/bin/env node
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadState, readPayload, ROOT } from './hook-pipeline-common.mjs';

readPayload((payload) => {
  const state = loadState();
  const dir = join(ROOT, 'tasks', 'reports');
  try {
    mkdirSync(dir, { recursive: true });
    const items = Object.entries(state.items)
      .map(([s, i]) => `${s}:${i.stage}${i.awaiting ? `(${i.awaiting})` : ''}`)
      .join(',') || 'none';
    appendFileSync(
      join(dir, 'pipeline-sessions.md'),
      `- ${new Date().toISOString()} session=${payload?.session_id || 'unknown'} reason=${payload?.reason || 'unknown'} active=${state.active || 'null'} items=${items}\n`,
    );
  } catch {
    // reporting must never block session end
  }
  process.exit(0);
});
