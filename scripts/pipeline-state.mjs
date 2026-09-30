#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.DEVIN_PROJECT_DIR || process.cwd();
const TASKS_DIR = join(ROOT, 'tasks');
const STATE_FILE = join(TASKS_DIR, 'pipeline-state.json');
const SELF_DIR = dirname(fileURLToPath(import.meta.url));

const STAGES = new Set(['analyze', 'specify', 'design', 'deliver', 'shipped', 'dropped']);
const TERMINAL = new Set(['shipped', 'dropped']);
const MODES = new Set(['interactive', 'all']);
const UI_SURFACE = new Set(['yes', 'no', 'unknown']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const GATES = new Set(['typecheck', 'lint', 'testUnit', 'build', 'browser', 'briefLint']);
const GATE_VERDICTS = new Set(['pass', 'fail']);
const ARTIFACT_KEYS = new Set(['intent', 'spec', 'designBrief', 'componentMapping', 'mockup', 'plan', 'reviews']);
const SETTABLE = new Set(['uiSurface', 'confidence', 'mode', 'awaiting', 'worktree']);
const PASS_VERDICTS = {
  analyze: new Set(['APPROVE', 'APPROVE_WITH_CHANGES', 'PASS']),
  spec: new Set(['APPROVE', 'APPROVE_WITH_CHANGES']),
  design: new Set(['PASS', 'APPROVE', 'APPROVE_WITH_CHANGES']),
  verify: new Set(['PASS']),
  signoff: new Set(['SIGN_OFF']),
};

const defaultArtifacts = {
  intent: (s) => `docs/intent/${s}.md`,
  spec: (s) => `docs/specs/${s}.md`,
  designBrief: (s) => `docs/intent/${s}-design-brief.md`,
  componentMapping: (s) => `docs/intent/${s}-component-mapping.md`,
  plan: (s) => `tasks/plan-${s}.md`,
};
const reviewPath = (slug, kind) => `docs/reviews/${slug}-${kind}.md`;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function assertMainWorktree() {
  const gitPath = join(ROOT, '.git');
  if (!existsSync(gitPath) || !statSync(gitPath).isDirectory()) {
    fail(`pipeline-state: writes allowed from main worktree only (.git must be a directory; root=${ROOT})`);
  }
}

function readState() {
  if (!existsSync(STATE_FILE)) return { active: null, items: {} };
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.items !== 'object') {
      fail(`pipeline-state: corrupt state file ${STATE_FILE}`);
    }
    return { active: parsed.active ?? null, items: parsed.items ?? {} };
  } catch (err) {
    if (err.code === 'ENOENT') return { active: null, items: {} };
    fail(`pipeline-state: corrupt state file ${STATE_FILE} (${err.message})`);
  }
}

function writeState(state) {
  assertMainWorktree();
  mkdirSync(TASKS_DIR, { recursive: true });
  const tmp = join(TASKS_DIR, `.pipeline-state-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, STATE_FILE);
}

function getItem(state, slug) {
  const item = state.items[slug];
  if (!item) fail(`pipeline-state: no item '${slug}'`);
  return item;
}

function takeFlag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1] ?? null;
  args.splice(i, v === null ? 1 : 2);
  return v;
}

function callerId(args) {
  const explicit = takeFlag(args, '--owner');
  if (explicit) return explicit;
  return process.env.CELL_AGENT_ID || 'human';
}

function claimIfUnowned(item, slug, caller) {
  if (caller === 'human') return;
  item.owner = { id: caller, since: new Date().toISOString() };
  process.stderr.write(`pipeline-state: '${slug}' claimed by '${caller}'\n`);
}

function requireOwner(item, slug, caller) {
  if (!item.owner) {
    claimIfUnowned(item, slug, caller);
    return;
  }
  if (item.owner.id === caller) return;
  if (caller === 'human') {
    process.stderr.write(`pipeline-state: warning — '${slug}' is owned by '${item.owner.id}'; proceeding as human override\n`);
    return;
  }
  fail(`pipeline-state: '${slug}' is owned by '${item.owner.id}' — only that agent may mutate it; use request-handoff, or ask the owner/human to handoff or release`);
}

function touch(item) {
  item.updated = new Date().toISOString();
}

function artifactOf(item, slug, key) {
  return item.artifacts?.[key] || defaultArtifacts[key]?.(slug) || null;
}

function absPath(rel) {
  return join(ROOT, rel);
}

function requireFile(rel, label) {
  if (!rel || !existsSync(absPath(rel))) fail(`pipeline-state: missing ${label} (${rel})`);
  return absPath(rel);
}

function parseVerdict(fileAbs) {
  const lines = readFileSync(fileAbs, 'utf8').split('\n');
  let verdict = null;
  for (const line of lines) {
    const m = line.match(/^VERDICT:\s*(\S+)\s*$/);
    if (m) verdict = m[1];
  }
  return verdict;
}

function checkReview(slug, kind, inputRel) {
  const rel = reviewPath(slug, kind);
  const abs = requireFile(rel, `${kind} review artifact`);
  const verdict = parseVerdict(abs);
  if (!verdict) fail(`pipeline-state: ${rel} has no 'VERDICT: <token>' line`);
  if (!PASS_VERDICTS[kind].has(verdict)) {
    fail(`pipeline-state: ${rel} verdict ${verdict} not in {${[...PASS_VERDICTS[kind]].join(',')}}`);
  }
  if (inputRel && existsSync(absPath(inputRel)) && statSync(abs).mtimeMs < statSync(absPath(inputRel)).mtimeMs) {
    fail(`pipeline-state: ${rel} is stale (older than ${inputRel})`);
  }
}

function sectionOf(text, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
  const m = text.match(re);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const end = rest.search(/^##\s+/m);
  return end < 0 ? rest : rest.slice(0, end);
}

function decisionOf(text) {
  const sec = sectionOf(text, 'Decision');
  if (!sec) return { value: null, reason: '' };
  const m = sec.match(/\b(no-go|defer|go)\b/i);
  if (!m) return { value: null, reason: '' };
  const reason = sec.slice(m.index + m[0].length).replace(/^[\s:;—–-]+/, '').replace(/\s+/g, ' ').trim();
  return { value: m[1].toLowerCase(), reason };
}

function journeyProblem(text) {
  const sec = sectionOf(text, 'Journey');
  if (!sec || !sec.trim()) return 'missing or empty ## Journey section';
  const asIs = sec.search(/as-?is/i);
  const toBe = sec.search(/to-?be/i);
  if (asIs < 0) return 'journey missing as-is marker';
  if (toBe < 0) return 'journey missing to-be marker';
  const stepLine = /^\s*(?:[-*]|\d+[.)])\s+\S/m;
  const count = (s) => (s.match(new RegExp(stepLine, 'gm')) || []).length;
  const [first, second] = asIs < toBe ? [sec.slice(asIs, toBe), sec.slice(toBe)] : [sec.slice(toBe, asIs), sec.slice(asIs)];
  if (count(first) < 3) return 'journey first part has <3 step lines';
  if (count(second) < 3) return 'journey second part has <3 step lines';
  return null;
}

function mtimeOf(abs) {
  try {
    const st = statSync(abs);
    if (!st.isDirectory()) return st.mtimeMs;
    let max = st.mtimeMs;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const m = mtimeOf(join(abs, e.name));
      if (m > max) max = m;
    }
    return max;
  } catch {
    return 0;
  }
}

function gitHead() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function dirtyTreePaths() {
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (st.status !== 0) return [];
  return st.stdout
    .split('\n')
    .map((l) => l.slice(3).split(' -> ').pop().trim())
    .filter((f) => f && f !== 'tasks/pipeline-state.json');
}

function newestSrcMtime() {
  const st = spawnSync('git', ['status', '--porcelain', 'src/'], { cwd: ROOT, encoding: 'utf8' });
  if (st.status !== 0) return 0;
  const mtimes = st.stdout
    .split('\n')
    .map((l) => l.slice(3).split(' -> ').pop().trim())
    .filter(Boolean)
    .map((f) => mtimeOf(join(ROOT, f)));
  if (mtimes.length) return Math.max(...mtimes);
  const lg = spawnSync('git', ['log', '-1', '--format=%cI'], { cwd: ROOT, encoding: 'utf8' });
  return lg.status === 0 ? Date.parse(lg.stdout.trim()) || 0 : 0;
}

function markBacklogDropped(slug, reason) {
  const p = absPath('docs/ideas/product-backlog.md');
  if (!existsSync(p)) return false;
  const lines = readFileSync(p, 'utf8').split('\n');
  const idx = lines.findIndex((l) => l.startsWith('|') && l.includes(`\`${slug}\``));
  if (idx < 0) return false;
  const cells = lines[idx].split('|');
  const statusIdx = cells.findIndex((c) =>
    /^\s*(icebox|analyzed|specced|designed|planned|in-progress|shipped)\s*$/.test(c));
  if (statusIdx < 0) return false;
  cells[statusIdx] = ` dropped — ${reason.slice(0, 80)} `;
  lines[idx] = cells.join('|');
  writeFileSync(p, lines.join('\n'));
  return true;
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runNpmGates() {
  const failed = [];
  for (const g of ['typecheck', 'lint', 'test:unit', 'build']) {
    const r = spawnSync(npmCmd, ['run', g], { cwd: ROOT, encoding: 'utf8', timeout: 600000, shell: true });
    if (r.status !== 0) failed.push(`npm run ${g} (exit ${r.status})`);
  }
  return failed;
}

function clearActiveIf(state, slug) {
  if (state.active === slug) state.active = null;
}

function doInit(slug, mode, force, caller) {
  if (!slug) fail('usage: pipeline-state.mjs init <slug> --mode <interactive|all> [--force] [--owner <id>]');
  if (!MODES.has(mode)) fail(`pipeline-state: invalid --mode '${mode}'`);
  const state = readState();
  if (state.active && !force) fail(`pipeline-state: item '${state.active}' already active — ship/drop it first (or --force to take the pointer while it is worked elsewhere)`);
  if (state.items[slug]) fail(`pipeline-state: item '${slug}' already exists — use a new slug to re-open`);
  state.items[slug] = {
    stage: 'analyze',
    mode,
    uiSurface: 'unknown',
    artifacts: {},
    gates: {},
    confidence: 'medium',
    awaiting: null,
    resolutions: [],
    loops: 0,
    owner: caller === 'human' ? null : { id: caller, since: new Date().toISOString() },
    worktree: null,
    updated: new Date().toISOString(),
  };
  state.active = slug;
  writeState(state);
  process.stdout.write(`${JSON.stringify(state.items[slug], null, 2)}\n`);
}

function doGet(slug) {
  const state = readState();
  process.stdout.write(`${JSON.stringify(getItem(state, slug), null, 2)}\n`);
}

function doActivate(slug, args) {
  if (!slug) fail('usage: pipeline-state.mjs activate <slug> [--owner <id>]');
  const caller = callerId(args);
  const state = readState();
  const item = getItem(state, slug);
  if (TERMINAL.has(item.stage)) fail(`pipeline-state: '${slug}' is ${item.stage} — cannot activate a terminal item`);
  requireOwner(item, slug, caller);
  state.active = slug;
  writeState(state);
  process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
}

function doSet(slug, pairs) {
  const caller = callerId(pairs);
  const state = readState();
  const item = getItem(state, slug);
  requireOwner(item, slug, caller);
  if (!pairs.length) fail('usage: pipeline-state.mjs set <slug> <field>=<value> [...]');
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq < 0) fail(`pipeline-state: malformed assignment '${pair}'`);
    const field = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (field.startsWith('artifacts.')) {
      const key = field.slice('artifacts.'.length);
      if (!ARTIFACT_KEYS.has(key)) fail(`pipeline-state: unknown artifacts key '${key}'`);
      if (key === 'reviews') {
        item.artifacts.reviews = item.artifacts.reviews || [];
        if (!item.artifacts.reviews.includes(value)) item.artifacts.reviews.push(value);
      } else {
        item.artifacts[key] = value;
      }
      continue;
    }
    if (field === 'awaiting') {
      if (!value || value === 'null') fail('pipeline-state: clearing awaiting requires resolve <slug> --note');
      item.awaiting = value;
      continue;
    }
    if (field === 'stage' || field === 'loops' || field === 'resolutions' || field === 'active' || field === 'updated'
      || field === 'owner' || field.startsWith('gates')) {
      fail(`pipeline-state: field '${field}' is not settable (stage→transition, gates→gates --set, owner→handoff|release, awaiting=null→resolve)`);
    }
    if (!SETTABLE.has(field)) fail(`pipeline-state: unknown field '${field}'`);
    if (field === 'uiSurface' && !UI_SURFACE.has(value)) fail(`pipeline-state: uiSurface must be yes|no|unknown`);
    if (field === 'confidence' && !CONFIDENCE.has(value)) fail(`pipeline-state: confidence must be high|medium|low`);
    if (field === 'mode' && !MODES.has(value)) fail(`pipeline-state: mode must be interactive|all`);
    item[field] = value;
  }
  touch(item);
  writeState(state);
  process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
}

function doGates(slug, args) {
  const caller = callerId(args);
  const state = readState();
  const item = getItem(state, slug);
  requireOwner(item, slug, caller);
  const si = args.indexOf('--set');
  if (si < 0 || !args[si + 1]) fail('usage: pipeline-state.mjs gates <slug> --set <gate>=<pass|fail>');
  const [gate, v] = args[si + 1].split('=');
  if (!GATES.has(gate)) fail(`pipeline-state: unknown gate '${gate}'`);
  if (!GATE_VERDICTS.has(v)) fail(`pipeline-state: gate verdict must be pass|fail`);
  item.gates = item.gates || {};
  item.gates[gate] = { v, at: new Date().toISOString(), head: gitHead(), dirty: dirtyTreePaths() };
  if (v === 'pass' && item.gates[gate].dirty.length) {
    process.stderr.write(
      `pipeline-state: note — '${gate}' recorded on dirty tree (${item.gates[gate].dirty.length} uncommitted path(s)); verdict covers uncommitted state\n`,
    );
  }
  touch(item);
  writeState(state);
  process.stdout.write(`${JSON.stringify(item.gates, null, 2)}\n`);
}

function doResolve(slug, args) {
  const caller = callerId(args);
  const state = readState();
  const item = getItem(state, slug);
  requireOwner(item, slug, caller);
  const ni = args.indexOf('--note');
  const note = ni >= 0 ? args[ni + 1] : null;
  if (!note) fail('usage: pipeline-state.mjs resolve <slug> --note "<reason>"');
  if (!item.awaiting) fail(`pipeline-state: item '${slug}' has nothing awaiting`);
  const flag = item.awaiting;
  item.resolutions = item.resolutions || [];
  item.resolutions.push({ flag, note, at: new Date().toISOString() });
  if (flag === 'flagged:loop-cap') item.loops = 0;
  item.awaiting = null;
  touch(item);
  writeState(state);
  process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
}

function requireNoAwaiting(item, slug) {
  if (item.awaiting) {
    fail(`pipeline-state: item '${slug}' awaiting '${item.awaiting}' — resolve first`);
  }
}

function doTransition(slug, args) {
  const caller = callerId(args);
  const state = readState();
  const item = getItem(state, slug);
  requireOwner(item, slug, caller);
  const ti = args.indexOf('--to');
  const to = ti >= 0 ? args[ti + 1] : null;
  if (!STAGES.has(to)) fail(`pipeline-state: invalid --to '${to}' (analyze|specify|design|deliver|shipped|dropped)`);
  const from = item.stage;
  if (TERMINAL.has(from)) fail(`pipeline-state: '${from}' is terminal — no transitions out`);
  requireNoAwaiting(item, slug);

  if (from === 'analyze' && to === 'specify') {
    const intentRel = artifactOf(item, slug, 'intent');
    const intentAbs = requireFile(intentRel, 'intent doc');
    checkReview(slug, 'analyze', intentRel);
    const text = readFileSync(intentAbs, 'utf8');
    const jp = journeyProblem(text);
    if (jp) fail(`pipeline-state: ${jp}`);
    const d = decisionOf(text);
    if (d.value === 'defer') fail(`pipeline-state: Decision=defer — stays in analyze`);
    if (d.value === 'no-go') fail(`pipeline-state: Decision=no-go — use transition --to dropped`);
    if (d.value !== 'go') fail(`pipeline-state: intent doc has no '## Decision' == go`);
    item.stage = 'specify';
  } else if (from === 'analyze' && to === 'dropped') {
    const intentRel = artifactOf(item, slug, 'intent');
    const intentAbs = requireFile(intentRel, 'intent doc');
    const d = decisionOf(readFileSync(intentAbs, 'utf8'));
    if (d.value !== 'no-go') fail(`pipeline-state: dropping requires '## Decision' == no-go (found ${d.value || 'none'})`);
    if (!d.reason) fail(`pipeline-state: no-go requires a reason in the Decision section`);
    item.stage = 'dropped';
    clearActiveIf(state, slug);
    if (!markBacklogDropped(slug, d.reason)) {
      process.stderr.write(`pipeline-state: warning — no backlog row for '${slug}' to mark dropped\n`);
    }
  } else if (from === 'specify' && (to === 'design' || to === 'deliver')) {
    const specRel = artifactOf(item, slug, 'spec');
    requireFile(specRel, 'spec doc');
    checkReview(slug, 'spec', specRel);
    if (item.uiSurface === 'unknown') {
      fail(`pipeline-state: uiSurface unknown — set uiSurface=<yes|no> (check ui_surface in intent doc)`);
    }
    if (to === 'design' && item.uiSurface !== 'yes') {
      fail(`pipeline-state: uiSurface=${item.uiSurface} — design stage requires uiSurface=yes`);
    }
    if (to === 'deliver' && item.uiSurface !== 'no') {
      fail(`pipeline-state: uiSurface=${item.uiSurface} — skipping design requires uiSurface=no`);
    }
    item.stage = to;
  } else if (from === 'design' && to === 'deliver') {
    const mappingRel = artifactOf(item, slug, 'componentMapping');
    requireFile(mappingRel, 'component mapping');
    const checker = join(SELF_DIR, 'check-design-brief.mjs');
    if (!existsSync(checker)) fail(`pipeline-state: design brief checker missing (${checker})`);
    const lint = spawnSync(process.execPath, [checker, slug], { cwd: ROOT, encoding: 'utf8' });
    if (lint.status !== 0) {
      fail(`pipeline-state: check-design-brief failed\n${lint.stderr || lint.stdout}`);
    }
    checkReview(slug, 'design', mappingRel);
    item.stage = 'deliver';
  } else if (['design', 'specify', 'deliver'].includes(from) && to === 'analyze') {
    if (item.loops >= 3) {
      fail(`pipeline-state: loop cap reached (${item.loops}) — set awaiting=flagged:loop-cap and resolve with human decision`);
    }
    item.loops += 1;
    item.stage = 'analyze';
  } else if (from === 'deliver' && to === 'shipped') {
    checkReview(slug, 'verify', artifactOf(item, slug, 'plan'));
    if (item.mode === 'all') {
      const failed = runNpmGates();
      if (failed.length) fail(`pipeline-state: gate re-run failed: ${failed.join('; ')}`);
    } else {
      checkReview(slug, 'signoff', null);
      const newest = newestSrcMtime();
      const headNow = gitHead();
      const required = ['typecheck', 'lint', 'testUnit', 'build'];
      if (item.uiSurface === 'yes') required.push('browser');
      for (const g of required) {
        const rec = item.gates?.[g];
        if (!rec || rec.v !== 'pass') fail(`pipeline-state: gate '${g}' missing or not pass — run it`);
        if (newest && Date.parse(rec.at) < newest) fail(`pipeline-state: gate '${g}' stale (older than newest src change)`);
        if (rec.head && headNow && rec.head !== headNow) {
          fail(`pipeline-state: gate '${g}' recorded at ${rec.head.slice(0, 8)} but HEAD is ${headNow.slice(0, 8)} — re-run gates on committed state`);
        }
      }
    }
    item.stage = 'shipped';
    clearActiveIf(state, slug);
  } else {
    fail(`pipeline-state: no transition ${from} → ${to}`);
  }
  if (TERMINAL.has(item.stage)) item.owner = null;
  touch(item);
  writeState(state);
  process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
}

function inferStage(slug) {
  const has = (rel) => existsSync(absPath(rel));
  if (has(`docs/intent/${slug}-design-brief.md`) || has(`docs/intent/${slug}-component-mapping.md`)) return 'design';
  if (has(`docs/specs/${slug}.md`)) return 'specify';
  if (has(`docs/intent/${slug}.md`)) return 'analyze';
  return null;
}

function doSeed(slug, force, caller) {
  if (!slug) fail('usage: pipeline-state.mjs seed <slug> [--force] [--owner <id>]');
  const state = readState();
  if (state.active && !force) fail(`pipeline-state: item '${state.active}' already active`);
  if (state.items[slug]) fail(`pipeline-state: item '${slug}' already exists`);
  let stage = inferStage(slug);
  const gaps = [];
  if (existsSync(absPath(`tasks/plan-${slug}.md`))) stage = 'deliver';
  if (stage === 'deliver' && !existsSync(absPath(reviewPath(slug, 'verify')))) {
    gaps.push('verify artifact missing');
  }
  if (stage === 'design' && !existsSync(absPath(reviewPath(slug, 'design')))) {
    gaps.push('design review missing');
  }
  if (stage === 'specify' && !existsSync(absPath(reviewPath(slug, 'spec')))) {
    gaps.push('spec review missing');
  }
  if (stage && stage !== 'analyze' && !existsSync(absPath(reviewPath(slug, 'analyze')))) {
    gaps.push('analyze review missing');
  }
  if (!stage) fail(`pipeline-state: no artifacts found for '${slug}' — nothing to seed`);
  state.items[slug] = {
    stage,
    mode: 'interactive',
    uiSurface: 'unknown',
    artifacts: {},
    gates: {},
    confidence: 'low',
    awaiting: gaps.length ? 'flagged:seeded' : null,
    resolutions: [],
    loops: 0,
    owner: caller === 'human' ? null : { id: caller, since: new Date().toISOString() },
    worktree: null,
    updated: new Date().toISOString(),
  };
  state.active = slug;
  writeState(state);
  if (gaps.length) {
    process.stderr.write(`pipeline-state: seeded '${slug}' at '${stage}' flagged:seeded — ${gaps.join('; ')}\n`);
  }
  process.stdout.write(`${JSON.stringify(state.items[slug], null, 2)}\n`);
}

function doRequestHandoff(slug, args) {
  const note = takeFlag(args, '--note');
  const caller = callerId(args);
  if (!slug || !note) fail('usage: pipeline-state.mjs request-handoff <slug> --note "<reason>" [--owner <id>]');
  if (caller === 'human') fail('pipeline-state: request-handoff needs an agent identity (--owner or CELL_AGENT_ID); humans can run handoff directly');
  const state = readState();
  const item = getItem(state, slug);
  if (TERMINAL.has(item.stage)) fail(`pipeline-state: '${slug}' is ${item.stage} — nothing to hand off`);
  if (!item.owner) fail(`pipeline-state: '${slug}' is unowned — activate or handoff it directly, no request needed`);
  if (item.owner.id === caller) fail(`pipeline-state: you already own '${slug}'`);
  if (item.awaiting) fail(`pipeline-state: '${slug}' awaiting '${item.awaiting}' — owner must resolve first`);
  item.awaiting = `handoff:${caller}`;
  item.resolutions = item.resolutions || [];
  item.resolutions.push({ flag: 'handoff-requested', note: `${caller}: ${note}`, at: new Date().toISOString() });
  touch(item);
  writeState(state);
  process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
}

function doHandoff(slug, args) {
  const to = takeFlag(args, '--to');
  const note = takeFlag(args, '--note');
  const caller = callerId(args);
  if (!slug || !to) fail('usage: pipeline-state.mjs handoff <slug> --to <new-owner> [--note "<reason>"]');
  const state = readState();
  const item = getItem(state, slug);
  if (TERMINAL.has(item.stage)) fail(`pipeline-state: '${slug}' is ${item.stage} — cannot hand off a terminal item`);
  if (item.owner && item.owner.id !== caller && caller !== 'human') {
    fail(`pipeline-state: '${slug}' is owned by '${item.owner.id}' — only the owner or a human may hand it off`);
  }
  const prev = item.owner?.id ?? 'unowned';
  item.owner = { id: to, since: new Date().toISOString() };
  item.resolutions = item.resolutions || [];
  if (item.awaiting?.startsWith('handoff:')) {
    item.resolutions.push({ flag: item.awaiting, note: note || `handed off to ${to}`, at: new Date().toISOString() });
    item.awaiting = null;
  }
  item.resolutions.push({ flag: 'ownership-handoff', note: `${prev} → ${to}${note ? ` — ${note}` : ''}`, at: new Date().toISOString() });
  touch(item);
  writeState(state);
  process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
}

function doRelease(slug, args) {
  const fi = args.indexOf('--force');
  const force = fi >= 0;
  if (force) args.splice(fi, 1);
  const note = takeFlag(args, '--note');
  const caller = callerId(args);
  if (!slug || !force || !note) fail('usage: pipeline-state.mjs release <slug> --force --note "<reason>"');
  const state = readState();
  const item = getItem(state, slug);
  const prev = item.owner?.id ?? null;
  if (!prev) fail(`pipeline-state: '${slug}' has no owner to release`);
  item.owner = null;
  if (item.awaiting?.startsWith('handoff:')) item.awaiting = null;
  item.resolutions = item.resolutions || [];
  item.resolutions.push({ flag: 'ownership-released', note: `${prev} released by ${caller} — ${note}`, at: new Date().toISOString() });
  touch(item);
  writeState(state);
  process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
}

const [, , cmd, ...rest] = process.argv;
const slug = rest[0];
const flag = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : null;
};

switch (cmd) {
  case 'init':
    doInit(slug, flag('--mode') || 'interactive', rest.includes('--force'), callerId(rest.slice(1)));
    break;
  case 'activate':
    doActivate(slug, rest.slice(1));
    break;
  case 'get':
    if (!slug) fail('usage: pipeline-state.mjs get <slug>');
    doGet(slug);
    break;
  case 'set':
    doSet(slug, rest.slice(1));
    break;
  case 'transition':
    doTransition(slug, rest.slice(1));
    break;
  case 'gates':
    doGates(slug, rest.slice(1));
    break;
  case 'resolve':
    doResolve(slug, rest.slice(1));
    break;
  case 'seed':
    doSeed(slug, rest.includes('--force'), callerId(rest.slice(1)));
    break;
  case 'request-handoff':
    doRequestHandoff(slug, rest.slice(1));
    break;
  case 'handoff':
    doHandoff(slug, rest.slice(1));
    break;
  case 'release':
    doRelease(slug, rest.slice(1));
    break;
  default:
    fail('usage: pipeline-state.mjs init|activate|get|set|transition|gates|resolve|seed|request-handoff|handoff|release <slug> [args]');
}
