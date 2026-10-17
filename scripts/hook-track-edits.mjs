#!/usr/bin/env node
// PreToolUse(write|edit|notebook_edit) — append the touched path to this
// session's edit log. hook-stop-gate reads it at Stop time to tell "files
// this session dirtied" apart from another lane's in-flight work — without
// it, a clean-tree gate would force committing other agents' files.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readPayload, ROOT } from './hook-pipeline-common.mjs';

readPayload((payload) => {
  const fp = String(payload?.tool_input?.file_path || payload?.tool_input?.notebook_path || '');
  const sid = String(payload?.session_id || 'anon');
  if (!fp) process.exit(0);
  const log = join(ROOT, 'tmp', `session-edits-${sid}.log`);
  try {
    appendFileSync(log, fp.replace(/\\/g, '/') + '\n');
  } catch {
    try {
      mkdirSync(join(ROOT, 'tmp'), { recursive: true });
      appendFileSync(log, fp.replace(/\\/g, '/') + '\n');
    } catch {
      /* unwritable tmp → stop-gate falls back to warn-only */
    }
  }
  process.exit(0);
});
