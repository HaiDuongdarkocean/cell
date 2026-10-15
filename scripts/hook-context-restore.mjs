#!/usr/bin/env node
import { activeSummary, emitContext, gitSnapshot, loadState, readPayload } from './hook-pipeline-common.mjs';

readPayload((payload) => {
  const state = loadState();
  const slug = state.active;
  const item = slug && state.items[slug];

  if (item && item.owner?.sessionId === payload?.session_id) {
    const summary = activeSummary(state);
    if (summary) {
      emitContext(
        'PostCompaction',
        `${summary} Post-compaction restore: re-read AGENTS.md mandate and tasks/pipeline-state.json before continuing.`,
      );
    }
    process.exit(0);
  }

  // Ad-hoc sessions compact too — restore from git, the only durable state.
  const snap = gitSnapshot();
  if (!snap) process.exit(0);
  const parts = [`branch ${snap.branch}`];
  if (snap.dirtyCount) parts.push(`${snap.dirtyCount} dirty: ${snap.dirtySample.join(', ')}`);
  if (snap.recent.length) parts.push(`recent: ${snap.recent.join(' | ')}`);
  emitContext(
    'PostCompaction',
    `Post-compaction restore (ad-hoc, no pipeline item): ${parts.join(' · ')}. Re-read the files being edited before continuing.`,
  );
  process.exit(0);
});
