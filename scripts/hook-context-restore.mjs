#!/usr/bin/env node
import { activeSummary, emitContext, loadState, readPayload } from './hook-pipeline-common.mjs';

readPayload(() => {
  const summary = activeSummary(loadState());
  if (summary) {
    emitContext(
      'PostCompaction',
      `${summary} Post-compaction restore: re-read AGENTS.md mandate and tasks/pipeline-state.json before continuing.`,
    );
  }
  process.exit(0);
});
