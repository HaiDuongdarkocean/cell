#!/usr/bin/env node
import { activeSummary, emitContext, loadState, readPayload, stagePointer } from './hook-pipeline-common.mjs';

readPayload((payload) => {
  const state = loadState();
  const slug = state.active;
  const item = slug && state.items[slug];
  if (!item) process.exit(0);

  const sid = payload?.session_id;
  const owner = item.owner;
  let text;
  if (owner?.sessionId && owner.sessionId === sid) {
    text = `${activeSummary(state)} Bound to this session (${owner.id}).`;
  } else if (owner) {
    text = `PIPELINE: active '${slug}' stage=${item.stage} owned by '${owner.id}' in another session — do not pick it up unless the user asks.`
      + (owner.sessionId ? '' : ` If you are ${owner.id}, run any pipeline-state command with --owner ${owner.id} to bind this session.`);
  } else {
    const pointer = stagePointer(slug, item.stage);
    text = `PIPELINE: active '${slug}' stage=${item.stage} — unowned${pointer ? `, resume at ${pointer}` : ''} only when the user asks.`;
  }
  emitContext('SessionStart', text);
});
