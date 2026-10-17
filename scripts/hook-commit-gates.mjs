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

  // ADR gate: deleting an ADR orphans every `ADR-NNN` comment in src/ — the
  // 001–078 wipe left 162 files pointing at deleted memory. Deleting = never;
  // superseding = new ADR file, not a deletion.
  const dels = spawnSync('git', ['diff', '--cached', '--diff-filter=D', '--name-only'], { cwd: ROOT, encoding: 'utf8' });
  const adrDels = (dels.stdout ?? '').split('\n').map((l) => l.trim())
    .filter((f) => /^docs\/adr\/\d{3}-.+\.md$/.test(f));
  if (adrDels.length) {
    const hint = adrDels.map((f) => {
      const n = f.match(/^docs\/adr\/(\d{3})/)[1];
      const g = spawnSync('git', ['grep', '-l', `ADR-${n}`, '--', 'src/'], { cwd: ROOT, encoding: 'utf8' });
      const users = (g.stdout ?? '').split('\n').filter(Boolean).length;
      return `${f} (${users} src refs will dangle)`;
    });
    emitContext('PreToolUse', `ADR GATE: deleting ${hint.join('; ')}. ADRs are never deleted — supersede with a new record instead (AGENTS.md).`);
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

  // Secrets gate: AGENTS.md bans committing secrets — scan added lines for
  // high-confidence secret signatures. Warn-only: low-signal strings are
  // intentionally excluded to keep false positives near zero.
  const diff = spawnSync('git', ['diff', '--cached'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const added = (diff.stdout ?? '').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  const SECRET_RES = [
    /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    /\bAIza[0-9A-Za-z_-]{35}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36,}\b/,
    /\bgithub_pat_[0-9A-Za-z_]{22,}\b/,
    /\bxox[bpoas]-[0-9A-Za-z-]{10,}\b/,
    /\bBearer\s+[0-9A-Za-z._-]{20,}\b/,
  ];
  const leaks = added.filter((l) => SECRET_RES.some((re) => re.test(l)));
  if (leaks.length) {
    emitContext('PreToolUse', `SECRETS GATE: staged diff contains ${leaks.length} line(s) matching secret signatures — verify and remove before committing.`);
  }
  process.exit(0);
});
