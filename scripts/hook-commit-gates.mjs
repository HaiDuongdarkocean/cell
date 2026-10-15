#!/usr/bin/env node
// PreToolUse(exec) — AGENTS.md gates are text; this makes them fire at the
// moment of action. When `git commit` stages protected paths, warn (not
// block) unless a fresh green-flow marker exists in tmp/gate-<flow>.ok —
// the flow runner writes one after every successful flow.
// Fresh = marker written after the newest protected file's last edit.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { emitContext, readPayload, ROOT } from './hook-pipeline-common.mjs';

const GATES = [
  {
    re: /src\/features\/subtitle\/(ui\/(subtitleSplitView|mountSubtitle|SubtitlePanel)|logic\/youtubeSplitView)|findPlayerContainer/,
    flow: 'spamVerify',
    cmd: 're-read docs/specs/subtitle-split-view-ac.md, then probe.mjs --match youtube --ext --reload && run.mjs youtube spamVerify (in .agents/skills/testing-browser-with-profile/script/)',
  },
];

readPayload((payload) => {
  const cmd = String(payload?.tool_input?.command || '');
  if (!/git\s+commit/.test(cmd)) process.exit(0);

  const st = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8' });
  if (st.status !== 0) process.exit(0);
  const staged = st.stdout.split('\n').map((l) => l.trim()).filter(Boolean);

  const warnings = [];
  for (const gate of GATES) {
    const hit = staged.filter((f) => gate.re.test(f));
    if (!hit.length) continue;
    const marker = join(ROOT, 'tmp', `gate-${gate.flow}.ok`);
    let markerTs = 0;
    try { markerTs = JSON.parse(readFileSync(marker, 'utf8')).ts ?? 0; } catch { /* absent */ }
    const newestEdit = Math.max(...hit.map((f) => {
      try { return statSync(join(ROOT, f)).mtimeMs; } catch { return 0; }
    }));
    if (!existsSync(marker)) {
      warnings.push(`GATE MISSING: staged ${hit.join(', ')} requires ${gate.flow} — run: ${gate.cmd}`);
    } else if (markerTs < newestEdit) {
      warnings.push(`GATE STALE: ${gate.flow} marker predates latest edits to ${hit.join(', ')} — re-run: ${gate.cmd}`);
    }
  }
  if (warnings.length) {
    emitContext('PreToolUse', `COMMIT GATE: ${warnings.join(' | ')}`);
  }

  // Lesson gate: a fix commit is the end of a debug loop — AGENTS.md requires
  // an experience atom when the root cause is reusable. Warn unless a new atom
  // is staged/untracked or was added in the last 10 commits.
  if (/\bfix[:(]/i.test(cmd)) {
    const atomDir = '.agents/skills/learning-and-apply/experience';
    const work = spawnSync('git', ['status', '--porcelain', '--', atomDir], { cwd: ROOT, encoding: 'utf8' });
    const pendingAtom = (work.stdout ?? '').split('\n').some((l) => l.endsWith('.json'));
    const recent = spawnSync('git', ['log', '--diff-filter=A', '--name-only', '-n', '10', '--', atomDir], { cwd: ROOT, encoding: 'utf8' });
    const recentAtom = (recent.stdout ?? '').includes(`${atomDir}/`);
    if (!pendingAtom && !recentAtom) {
      emitContext('PreToolUse', 'LESSON GATE: fix commit with no new learning atom — if the root cause is reusable, write experience/<id>.json + index.json entry + run validate.cjs; if trivial/one-off, ignore.');
    }
  }
  process.exit(0);
});
