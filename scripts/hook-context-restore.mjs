#!/usr/bin/env node
import { activeSummary, emitContext, loadState, readPayload } from './hook-pipeline-common.mjs';

readPayload((payload) => {
  const state = loadState();
  const slug = state.active;
  const item = slug && state.items[slug];
  if (!item || item.owner?.sessionId !== payload?.session_id) process.exit(0);

  const summary = activeSummary(state);
  if (summary) {
    emitContext(
      'PostCompaction',
      `${summary} Post-compaction restore: re-read AGENTS.md mandate and tasks/pipeline-state.json before continuing.`,
    );
  }
  process.exit(0);
});
