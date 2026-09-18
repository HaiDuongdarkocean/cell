#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { emitBlock, loadState, newestSrcMtime, readPayload, ROOT } from './hook-pipeline-common.mjs';

readPayload((payload) => {
  if (payload?.stop_hook_active) process.exit(0);
  const state = loadState();
  const slug = state.active;
  const item = slug && state.items[slug];
  if (!item || item.stage !== 'deliver' || item.awaiting) process.exit(0);

  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (dirty.status !== 0 || !dirty.stdout.trim()) process.exit(0);

  const newest = newestSrcMtime();
  const required = ['typecheck', 'lint', 'testUnit', 'build'];
  if (item.uiSurface === 'yes') required.push('browser');
  const stale = required.filter((g) => {
    const rec = item.gates?.[g];
    return !rec || rec.v !== 'pass' || (newest && Date.parse(rec.at) < newest);
  });
  if (!stale.length) process.exit(0);

  emitBlock(
    `PIPELINE: '${slug}' in deliver with dirty tree and stale/missing gates (${stale.join(', ')}). Rerun gates or resolve before stopping.`,
  );
});
