import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.DEVIN_PROJECT_DIR || process.cwd();
export const STATE_FILE = join(ROOT, 'tasks', 'pipeline-state.json');
export const PIPELINE_CLI = join(dirname(fileURLToPath(import.meta.url)), 'pipeline-state.mjs');

export function readPayload(done) {
  let input = '';
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    try {
      done(JSON.parse(input.replace(/\uFEFF/, '') || '{}'));
    } catch {
      process.exit(0);
    }
  };
  process.stdin.on('data', (c) => { input += c; });
  process.stdin.on('end', finish);
  setTimeout(finish, 3000).unref();
}

export function loadState() {
  try {
    if (!existsSync(STATE_FILE)) return { active: null, items: {} };
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return { active: s.active ?? null, items: s.items ?? {} };
  } catch {
    return { active: null, items: {} };
  }
}

export function emitContext(event, text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  }));
  process.exit(0);
}

export function emitBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
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

export function gitSnapshot() {
  const br = spawnSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' });
  if (br.status !== 0) return null;
  const st = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  const dirty = (st.stdout ?? '').split('\n').filter(Boolean);
  const lg = spawnSync('git', ['log', '--oneline', '-3'], { cwd: ROOT, encoding: 'utf8' });
  return {
    branch: br.stdout.trim(),
    dirtyCount: dirty.length,
    dirtySample: dirty.slice(0, 8),
    recent: (lg.stdout ?? '').trim().split('\n').filter(Boolean),
  };
}

export function newestSrcMtime() {
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

export function stagePointer(slug, stage) {
  const map = {
    analyze: `docs/intent/${slug}.md`,
    specify: `docs/specs/${slug}.md`,
    design: `docs/intent/${slug}-design-brief.md`,
    deliver: `tasks/plan-${slug}.md`,
  };
  return map[stage] || null;
}

export function activeSummary(state) {
  const slug = state.active;
  const item = slug && state.items[slug];
  if (!item) return null;
  const pointer = stagePointer(slug, item.stage);
  return `PIPELINE: active '${slug}' stage=${item.stage} mode=${item.mode} uiSurface=${item.uiSurface} awaiting=${item.awaiting || 'null'} loops=${item.loops}`
    + (pointer ? ` — resume at ${pointer}` : '')
    + '. Stage moves only via `node scripts/pipeline-state.mjs transition`.';
}
