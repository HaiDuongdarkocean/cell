#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { emitContext, loadState, readPayload, ROOT } from './hook-pipeline-common.mjs';

const PRE_DELIVER = new Set(['analyze', 'specify', 'design']);

readPayload((payload) => {
  const fp = String(payload?.tool_input?.file_path || payload?.tool_input?.notebook_path || '')
    .replace(/\\/g, '/');
  if (!fp) process.exit(0);

  if (/tasks\/pipeline-state\.json$/.test(fp)) {
    emitContext(
      'PreToolUse',
      `PIPELINE GUARD: tasks/pipeline-state.json is machine state — write it only via \`node scripts/pipeline-state.mjs <cmd>\`. Direct edits corrupt the audit trail.`,
    );
  }

  const state = loadState();
  const slug = state.active;
  const item = slug && state.items[slug];
  if (!item) process.exit(0);
  if (item.owner?.sessionId !== payload?.session_id) process.exit(0);

  const warnings = [];
  if (PRE_DELIVER.has(item.stage) && /(^|\/)src\//.test(fp) && !/src\/entrypoints\/mockup-/.test(fp)) {
    warnings.push(
      `active item '${slug}' is at stage '${item.stage}' — src/ edits belong to DELIVER (mockup-* exempt). If this is non-feature work, ignore.`,
    );
  }

  const specRel = `docs/specs/${slug}.md`;
  const reviewRel = `docs/reviews/${slug}-spec.md`;
  if (fp.endsWith(specRel) && existsSync(join(ROOT, specRel)) && existsSync(join(ROOT, reviewRel))) {
    if (statSync(join(ROOT, specRel)).mtimeMs > statSync(join(ROOT, reviewRel)).mtimeMs) {
      warnings.push(`spec changed after ${reviewRel} — review artifact is stale; re-review before transitioning.`);
    }
  }

  if (warnings.length) emitContext('PreToolUse', `PIPELINE GUARD: ${warnings.join(' ')}`);
  process.exit(0);
});
