import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPTS = join(__dirname, '../../../scripts');

type Result = { status: number | null; stdout: string; stderr: string };

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hook-'));
  for (const d of ['.git', 'tasks']) mkdirSync(join(root, d), { recursive: true });
  return root;
}

function run(script: string, root: string, payload: object): Result {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script)], {
    cwd: root,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 10000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function writeState(root: string, state: object) {
  writeFileSync(join(root, 'tasks/pipeline-state.json'), JSON.stringify(state));
}

const ACTIVE_DELIVER = {
  active: 'feat-x',
  items: {
    'feat-x': {
      stage: 'deliver', mode: 'interactive', uiSurface: 'no',
      artifacts: {}, gates: {}, awaiting: null, loops: 0,
    },
  },
};

const ACTIVE_ANALYZE = {
  active: 'feat-x',
  items: {
    'feat-x': {
      stage: 'analyze', mode: 'interactive', uiSurface: 'unknown',
      artifacts: {}, gates: {}, awaiting: null, loops: 0,
    },
  },
};

describe('hook-session-prime', () => {
  it('no-ops without active item', () => {
    const root = makeRoot();
    const r = run('hook-session-prime.mjs', root, { hook_event_name: 'SessionStart' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('injects stage-aware context with active item', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_ANALYZE);
    const r = run('hook-session-prime.mjs', root, { hook_event_name: 'SessionStart' });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(out.hookSpecificOutput.additionalContext).toMatch(/feat-x.*analyze/);
  });
});

describe('hook-stage-guard', () => {
  it('no-ops without active item on normal files', () => {
    const root = makeRoot();
    const r = run('hook-stage-guard.mjs', root, {
      hook_event_name: 'PreToolUse', tool_name: 'edit',
      tool_input: { file_path: 'src/features/x.ts' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('warns on src edit during pre-deliver stage', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_ANALYZE);
    const r = run('hook-stage-guard.mjs', root, {
      hook_event_name: 'PreToolUse', tool_name: 'edit',
      tool_input: { file_path: 'src/features/x.ts' },
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toMatch(/DELIVER/);
  });

  it('does not warn on mockup edits', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_ANALYZE);
    const r = run('hook-stage-guard.mjs', root, {
      hook_event_name: 'PreToolUse', tool_name: 'edit',
      tool_input: { file_path: 'src/entrypoints/mockup-feat-x/App.tsx' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('warns on direct state-file edit even when inactive', () => {
    const root = makeRoot();
    const r = run('hook-stage-guard.mjs', root, {
      hook_event_name: 'PreToolUse', tool_name: 'edit',
      tool_input: { file_path: 'tasks/pipeline-state.json' },
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toMatch(/pipeline-state\.mjs/);
  });
});

describe('hook-gates-tracker', () => {
  const execPayload = (command: string, success = true) => ({
    hook_event_name: 'PostToolUse', tool_name: 'exec',
    tool_input: { command },
    tool_response: { success, output: '', error: null },
  });

  it('records pass for gate command during deliver', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_DELIVER);
    const r = run('hook-gates-tracker.mjs', root, execPayload('npm run typecheck'));
    expect(r.status).toBe(0);
    const st = JSON.parse(readFileSync(join(root, 'tasks/pipeline-state.json'), 'utf8'));
    expect(st.items['feat-x'].gates.typecheck.v).toBe('pass');
  });

  it('records fail for failed gate command', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_DELIVER);
    run('hook-gates-tracker.mjs', root, execPayload('npx tsc --noEmit', false));
    const st = JSON.parse(readFileSync(join(root, 'tasks/pipeline-state.json'), 'utf8'));
    expect(st.items['feat-x'].gates.typecheck.v).toBe('fail');
  });

  it('ignores gate commands when not in deliver', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_ANALYZE);
    run('hook-gates-tracker.mjs', root, execPayload('npm run typecheck'));
    const st = JSON.parse(readFileSync(join(root, 'tasks/pipeline-state.json'), 'utf8'));
    expect(st.items['feat-x'].gates.typecheck).toBeUndefined();
  });
});

describe('hook-context-restore', () => {
  it('re-injects context after compaction', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_DELIVER);
    const r = run('hook-context-restore.mjs', root, { hook_event_name: 'PostCompaction' });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('PostCompaction');
    expect(out.hookSpecificOutput.additionalContext).toMatch(/deliver/);
  });
});

describe('hook-stop-gate', () => {
  it('blocks when deliver + dirty + missing gates', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_DELIVER);
    spawnSync('git', ['init'], { cwd: root });
    writeFileSync(join(root, 'dirty.txt'), 'x');
    const r = run('hook-stop-gate.mjs', root, { hook_event_name: 'Stop', stop_hook_active: false });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.decision).toBe('block');
    expect(out.reason).toMatch(/typecheck/);
  });

  it('lets second stop attempt through via stop_hook_active', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_DELIVER);
    spawnSync('git', ['init'], { cwd: root });
    writeFileSync(join(root, 'dirty.txt'), 'x');
    const r = run('hook-stop-gate.mjs', root, { hook_event_name: 'Stop', stop_hook_active: true });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('passes when gates fresh or not in deliver', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_ANALYZE);
    const r = run('hook-stop-gate.mjs', root, { hook_event_name: 'Stop', stop_hook_active: false });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe('hook-session-report', () => {
  it('appends a session line to tasks/reports', () => {
    const root = makeRoot();
    writeState(root, ACTIVE_DELIVER);
    const r = run('hook-session-report.mjs', root, {
      hook_event_name: 'SessionEnd', session_id: 's1', reason: 'exit',
    });
    expect(r.status).toBe(0);
    const report = join(root, 'tasks/reports/pipeline-sessions.md');
    expect(existsSync(report)).toBe(true);
    expect(readFileSync(report, 'utf8')).toMatch(/session=s1.*active=feat-x/);
  });
});

describe('fail-open contract', () => {
  it('malformed stdin exits 0 silently for every hook', () => {
    const root = makeRoot();
    for (const h of [
      'hook-session-prime.mjs', 'hook-stage-guard.mjs', 'hook-gates-tracker.mjs',
      'hook-context-restore.mjs', 'hook-stop-gate.mjs', 'hook-session-report.mjs',
    ]) {
      const r = spawnSync(process.execPath, [join(SCRIPTS, h)], {
        cwd: root, input: '{bad json', encoding: 'utf8', timeout: 10000,
      });
      expect(r.status).toBe(0);
      expect(r.stdout ?? '').toBe('');
    }
  });
});
