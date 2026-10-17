#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitBlock, emitContext, loadState, newestSrcMtime, readPayload, ROOT } from './hook-pipeline-common.mjs';

const sessionDirtyFiles = (payload) => {
  const sid = String(payload?.session_id || '');
  let logged;
  try {
    logged = readFileSync(join(ROOT, 'tmp', `session-edits-${sid}.log`), 'utf8')
      .split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (st.status !== 0) return [];
  return (st.stdout ?? '').split('\n').filter(Boolean)
    .map((l) => l.slice(3).replace(/ -> .+$/, '').replace(/^"|"$/g, '').replace(/\\/g, '/'))
    .filter((f) => logged.some((p) => p === f || p.endsWith('/' + f)));
};

readPayload((payload) => {
  if (payload?.stop_hook_active) process.exit(0);
  const state = loadState();
  const slug = state.active;
  const item = slug && state.items[slug];
  if (!item || item.stage !== 'deliver' || item.awaiting) {
    // Ad-hoc path: atomic-commit rule — files this session touched must be
    // verified and committed before stopping. Other lanes' dirty files are
    // filtered out via the session edit log; blocking fires once per dirty-set.
    const mine = sessionDirtyFiles(payload);
    if (!mine.length) process.exit(0);
    const key = createHash('sha1').update(`${payload?.session_id}:${mine.sort().join(',')}`).digest('hex').slice(0, 12);
    const marker = join(ROOT, 'tmp', `stop-block-${key}.done`);
    if (existsSync(marker)) {
      emitContext('Stop', `${mine.length} uncommitted file(s) from this session remain (${mine.slice(0, 4).join(', ')}…) — commit or discard if this work should persist.`);
    }
    try { writeFileSync(marker, String(Date.now())); } catch { /* warn anyway */ }
    const ui = mine.some((f) => /\.(tsx|css|module\.css)$/.test(f));
    emitBlock(
      `UNCOMMITTED SESSION WORK: ${mine.length} file(s) this session touched are dirty: ${mine.slice(0, 5).join(', ')}${mine.length > 5 ? ', …' : ''}. ` +
      `Atomic-commit rule — verify then commit before stopping: npm run typecheck && npm run lint && npm run test:related && npm run build` +
      `${ui ? ' + verify UI in a real browser (UI files touched)' : ''}, then commit via the git-workflow-and-versioning skill (atomic commits, YOUR files only). Dirty files you never touched belong to another lane — leave them alone.`,
    );
  }

  // Only the bound owner session carries gate pressure — other sessions must
  // never be drafted into this item's work.
  if (item.owner?.sessionId !== payload?.session_id) process.exit(0);

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
