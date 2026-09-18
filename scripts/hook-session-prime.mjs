#!/usr/bin/env node
import { activeSummary, emitContext, loadState, readPayload } from './hook-pipeline-common.mjs';

readPayload(() => {
  const summary = activeSummary(loadState());
  if (summary) emitContext('SessionStart', summary);
  process.exit(0);
});
