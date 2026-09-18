import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '../../../scripts/pipeline-state.mjs');
const SLUG = 'feat-x';

type Result = { status: number | null; stdout: string; stderr: string };

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'pstate-'));
  for (const d of ['.git', 'tasks', 'docs/intent', 'docs/specs', 'docs/reviews', 'docs/ideas']) {
    mkdirSync(join(root, d), { recursive: true });
  }
  return root;
}

function run(root: string, ...args: string[]): Result {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function init(root: string, mode = 'interactive') {
  return run(root, 'init', SLUG, '--mode', mode);
}

function writeIntent(root: string, decision = 'go', journey = true) {
  const journeySection = journey
    ? `## Journey

### AS-IS
- user opens the page
- user reads the content
- user leaves without value

### TO-BE
- user opens the page
- system surfaces the value
- user completes the goal

`
    : '';
  writeFileSync(
    join(root, 'docs/intent', `${SLUG}.md`),
    `# Intent\n\n${journeySection}## Decision\n${decision}\n`,
  );
}

function writeReview(root: string, kind: string, verdictLines: string[]) {
  writeFileSync(
    join(root, 'docs/reviews', `${SLUG}-${kind}.md`),
    `review body\n${verdictLines.join('\n')}\n`,
  );
}

function writeSpec(root: string) {
  writeFileSync(join(root, 'docs/specs', `${SLUG}.md`), `# Spec\n\n## Success Criteria\n- x\n`);
}

function age(root: string, rel: string, iso = '2020-01-01T00:00:00Z') {
  const t = new Date(iso);
  utimesSync(join(root, rel), t, t);
}

function stateOf(root: string) {
  return JSON.parse(readFileSync(join(root, 'tasks/pipeline-state.json'), 'utf8'));
}

function seedTo(root: string, stage: 'specify' | 'design' | 'deliver', mode = 'interactive') {
  init(root, mode);
  writeIntent(root);
  writeReview(root, 'analyze', ['VERDICT: APPROVE']);
  run(root, 'transition', SLUG, '--to', 'specify');
  writeSpec(root);
  writeReview(root, 'spec', ['VERDICT: APPROVE']);
  if (stage === 'specify') return;
  if (stage === 'design') {
    run(root, 'set', SLUG, 'uiSurface=yes');
    run(root, 'transition', SLUG, '--to', 'design');
    return;
  }
  run(root, 'set', SLUG, 'uiSurface=no');
  run(root, 'transition', SLUG, '--to', 'deliver');
}

describe('pipeline-state init/get', () => {
  it('init creates item at analyze and sets active', () => {
    const root = makeRoot();
    const r = init(root);
    expect(r.status).toBe(0);
    const st = stateOf(root);
    expect(st.active).toBe(SLUG);
    expect(st.items[SLUG].stage).toBe('analyze');
    expect(st.items[SLUG].mode).toBe('interactive');
    expect(st.items[SLUG].resolutions).toEqual([]);
  });

  it('refuses init when another item is active', () => {
    const root = makeRoot();
    init(root);
    const r = run(root, 'init', 'other', '--mode', 'all');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/already active/);
  });

  it('refuses init on existing slug after drop', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root, 'no-go — market too small');
    expect(run(root, 'transition', SLUG, '--to', 'dropped').status).toBe(0);
    const r = init(root);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/already exists/);
  });

  it('get exits 1 on missing item', () => {
    const root = makeRoot();
    expect(run(root, 'get', 'nope').status).toBe(1);
  });

  it('writes atomically without tmp leftovers', () => {
    const root = makeRoot();
    init(root);
    const leftovers = readdirSync(join(root, 'tasks')).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
  });
});

describe('pipeline-state set restrictions', () => {
  it('allows uiSurface, confidence, mode, artifacts, awaiting flag', () => {
    const root = makeRoot();
    init(root);
    expect(run(root, 'set', SLUG, 'uiSurface=yes').status).toBe(0);
    expect(run(root, 'set', SLUG, 'confidence=high').status).toBe(0);
    expect(run(root, 'set', SLUG, 'mode=all').status).toBe(0);
    expect(run(root, 'set', SLUG, 'artifacts.intent=docs/intent/custom.md').status).toBe(0);
    expect(run(root, 'set', SLUG, 'awaiting=user-approval:intent').status).toBe(0);
    const item = stateOf(root).items[SLUG];
    expect(item.uiSurface).toBe('yes');
    expect(item.awaiting).toBe('user-approval:intent');
    expect(item.artifacts.intent).toBe('docs/intent/custom.md');
  });

  it('rejects stage, gates, loops, awaiting=null', () => {
    const root = makeRoot();
    init(root);
    expect(run(root, 'set', SLUG, 'stage=deliver').status).toBe(1);
    expect(run(root, 'set', SLUG, 'gates.typecheck=pass').status).toBe(1);
    expect(run(root, 'set', SLUG, 'loops=0').status).toBe(1);
    expect(run(root, 'set', SLUG, 'awaiting=null').status).toBe(1);
    expect(run(root, 'set', SLUG, 'awaiting=').status).toBe(1);
    expect(run(root, 'set', SLUG, 'bogus=1').status).toBe(1);
  });
});

describe('transition analyze → specify', () => {
  it('passes with review + journey + go decision', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root);
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(0);
    expect(stateOf(root).items[SLUG].stage).toBe('specify');
  });

  it('refuses missing review artifact', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/analyze\.md/);
  });

  it('refuses stale review (older than intent)', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root);
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    age(root, `docs/reviews/${SLUG}-analyze.md`);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/stale/);
  });

  it('refuses missing Journey section', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root, 'go', false);
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Journey/);
  });

  it('refuses journey missing to-be marker', () => {
    const root = makeRoot();
    init(root);
    writeFileSync(
      join(root, 'docs/intent', `${SLUG}.md`),
      `# I\n\n## Journey\n\n### AS-IS\n- a\n- b\n- c\n\n## Decision\ngo\n`,
    );
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/to-be/i);
  });

  it('refuses journey with fewer than 3 steps in a part', () => {
    const root = makeRoot();
    init(root);
    writeFileSync(
      join(root, 'docs/intent', `${SLUG}.md`),
      `# I\n\n## Journey\n\n### AS-IS\n- a\n- b\n\n### TO-BE\n- a\n- b\n- c\n\n## Decision\ngo\n`,
    );
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/<3 step/);
  });

  it('refuses defer decision and points no-go to dropped', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root, 'defer — wait for infra');
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/defer/);
    writeIntent(root, 'no-go — not viable');
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    const r2 = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r2.status).toBe(1);
    expect(r2.stderr).toMatch(/dropped/);
  });
});

describe('VERDICT parsing', () => {
  it('last VERDICT line wins — REJECT after APPROVE refuses', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root);
    writeReview(root, 'analyze', ['VERDICT: APPROVE', 'notes', 'VERDICT: REJECT']);
    const r = run(root, 'transition', SLUG, '--to', 'specify');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/REJECT/);
  });

  it('APPROVE_WITH_CHANGES is not swallowed by APPROVE', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root);
    writeReview(root, 'analyze', ['VERDICT: APPROVE_WITH_CHANGES']);
    expect(run(root, 'transition', SLUG, '--to', 'specify').status).toBe(0);
  });
});

describe('transition analyze → dropped', () => {
  it('drops on no-go with reason, clears active, updates backlog', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root, 'no-go — roi negative');
    writeFileSync(
      join(root, 'docs/ideas/product-backlog.md'),
      `| # | Slug | Status |\n| 1 | \`${SLUG}\` | icebox |\n`,
    );
    const r = run(root, 'transition', SLUG, '--to', 'dropped');
    expect(r.status).toBe(0);
    const st = stateOf(root);
    expect(st.active).toBeNull();
    expect(st.items[SLUG].stage).toBe('dropped');
    expect(readFileSync(join(root, 'docs/ideas/product-backlog.md'), 'utf8')).toMatch(/dropped — roi negative/);
  });

  it('refuses drop without reason or without no-go', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root, 'no-go');
    expect(run(root, 'transition', SLUG, '--to', 'dropped').status).toBe(1);
    writeIntent(root, 'go');
    expect(run(root, 'transition', SLUG, '--to', 'dropped').status).toBe(1);
  });

  it('dropped is terminal', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root, 'no-go — roi negative');
    run(root, 'transition', SLUG, '--to', 'dropped');
    const r = run(root, 'transition', SLUG, '--to', 'analyze');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/terminal/);
  });
});

describe('transition specify → design|deliver', () => {
  it('routes by uiSurface', () => {
    const root = makeRoot();
    seedTo(root, 'specify');
    run(root, 'set', SLUG, 'uiSurface=yes');
    expect(run(root, 'transition', SLUG, '--to', 'design').status).toBe(0);
  });

  it('refuses unknown uiSurface with set hint', () => {
    const root = makeRoot();
    seedTo(root, 'specify');
    const r = run(root, 'transition', SLUG, '--to', 'design');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/set uiSurface/);
  });

  it('deliver requires uiSurface=no', () => {
    const root = makeRoot();
    seedTo(root, 'specify');
    run(root, 'set', SLUG, 'uiSurface=yes');
    expect(run(root, 'transition', SLUG, '--to', 'deliver').status).toBe(1);
    run(root, 'set', SLUG, 'uiSurface=no');
    expect(run(root, 'transition', SLUG, '--to', 'deliver').status).toBe(0);
  });
});

describe('transition design → deliver', () => {
  function writeDesignFixtures(root: string) {
    mkdirSync(join(root, 'src/shared/styles'), { recursive: true });
    writeFileSync(
      join(root, 'src/shared/styles/tokens.json'),
      JSON.stringify({ static: { 'space-md': '8px' } }),
    );
    mkdirSync(join(root, 'src/shared/ui'), { recursive: true });
    writeFileSync(join(root, 'src/shared/ui/Button.tsx'), 'export {};\n');
    mkdirSync(join(root, 'src/shared/icons'), { recursive: true });
    writeFileSync(
      join(root, 'src/shared/icons/index.ts'),
      'export const ICON_CATALOG = {\n  play: {},\n};\n',
    );
  }

  it('refuses when component mapping missing', () => {
    const root = makeRoot();
    seedTo(root, 'design');
    const r = run(root, 'transition', SLUG, '--to', 'deliver');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/component mapping/);
  });

  it('passes with mapping + lint-clean brief + design review', () => {
    const root = makeRoot();
    writeDesignFixtures(root);
    seedTo(root, 'design');
    writeFileSync(join(root, 'docs/intent', `${SLUG}-design-brief.md`), '# Brief\nIcon: play\n');
    writeFileSync(
      join(root, 'docs/intent', `${SLUG}-component-mapping.md`),
      '# Mapping\nComponent: Button\n',
    );
    writeReview(root, 'design', ['VERDICT: PASS']);
    const r = run(root, 'transition', SLUG, '--to', 'deliver');
    expect(r.status).toBe(0);
    expect(stateOf(root).items[SLUG].stage).toBe('deliver');
  });

  it('refuses when brief lint finds unknown references', () => {
    const root = makeRoot();
    writeDesignFixtures(root);
    seedTo(root, 'design');
    writeFileSync(
      join(root, 'docs/intent', `${SLUG}-design-brief.md`),
      '# Brief\nIcon: bogus-icon\n',
    );
    writeFileSync(
      join(root, 'docs/intent', `${SLUG}-component-mapping.md`),
      '# Mapping\nComponent: Button\n',
    );
    writeReview(root, 'design', ['VERDICT: PASS']);
    const r = run(root, 'transition', SLUG, '--to', 'deliver');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/bogus-icon/);
  });
});

describe('backward transitions and loop cap', () => {
  it('specify → analyze increments loops', () => {
    const root = makeRoot();
    seedTo(root, 'specify');
    expect(run(root, 'transition', SLUG, '--to', 'analyze').status).toBe(0);
    expect(stateOf(root).items[SLUG].loops).toBe(1);
  });

  it('refuses backward at loops >= 3', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root);
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    for (let i = 0; i < 3; i += 1) {
      expect(run(root, 'transition', SLUG, '--to', 'specify').status).toBe(0);
      expect(run(root, 'transition', SLUG, '--to', 'analyze').status).toBe(0);
    }
    run(root, 'transition', SLUG, '--to', 'specify');
    const r = run(root, 'transition', SLUG, '--to', 'analyze');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/loop cap/);
  });
});

describe('transition deliver → shipped', () => {
  function prep(root: string, mode: 'interactive' | 'all') {
    seedTo(root, 'deliver', mode);
    writeFileSync(join(root, 'tasks', `plan-${SLUG}.md`), '# Plan\n');
    writeReview(root, 'verify', ['VERDICT: PASS']);
  }

  it('interactive: ships with signoff + fresh gates, clears active', () => {
    const root = makeRoot();
    prep(root, 'interactive');
    writeReview(root, 'signoff', ['VERDICT: SIGN_OFF']);
    for (const g of ['typecheck', 'lint', 'testUnit', 'build']) {
      expect(run(root, 'gates', SLUG, '--set', `${g}=pass`).status).toBe(0);
    }
    const r = run(root, 'transition', SLUG, '--to', 'shipped');
    expect(r.status).toBe(0);
    const st = stateOf(root);
    expect(st.active).toBeNull();
    expect(st.items[SLUG].stage).toBe('shipped');
  });

  it('interactive: refuses missing signoff or missing gate', () => {
    const root = makeRoot();
    prep(root, 'interactive');
    const r = run(root, 'transition', SLUG, '--to', 'shipped');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/signoff/);
    writeReview(root, 'signoff', ['VERDICT: SIGN_OFF']);
    const r2 = run(root, 'transition', SLUG, '--to', 'shipped');
    expect(r2.status).toBe(1);
    expect(r2.stderr).toMatch(/typecheck/);
  });

  it('interactive: refuses stale gate older than newest src change', () => {
    const root = makeRoot();
    prep(root, 'interactive');
    writeReview(root, 'signoff', ['VERDICT: SIGN_OFF']);
    spawnSync('git', ['init'], { cwd: root });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'x.ts'), 'export {};\n');
    utimesSync(join(root, 'src', 'x.ts'), new Date(), new Date());
    for (const g of ['typecheck', 'lint', 'testUnit', 'build']) {
      run(root, 'gates', SLUG, '--set', `${g}=pass`);
    }
    const future = new Date(Date.now() + 60_000);
    utimesSync(join(root, 'src', 'x.ts'), future, future);
    const r = run(root, 'transition', SLUG, '--to', 'shipped');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/stale/);
  });

  it('all mode: re-runs npm gates instead of trusting cache', () => {
    const root = makeRoot();
    prep(root, 'all');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          typecheck: 'node -e "process.exit(0)"',
          lint: 'node -e "process.exit(0)"',
          'test:unit': 'node -e "process.exit(0)"',
          build: 'node -e "process.exit(1)"',
        },
      }),
    );
    const r = run(root, 'transition', SLUG, '--to', 'shipped');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/build/);
    expect(stateOf(root).items[SLUG].stage).toBe('deliver');
  });

  it('all mode: ships when npm gates pass', () => {
    const root = makeRoot();
    prep(root, 'all');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          typecheck: 'node -e "process.exit(0)"',
          lint: 'node -e "process.exit(0)"',
          'test:unit': 'node -e "process.exit(0)"',
          build: 'node -e "process.exit(0)"',
        },
      }),
    );
    const r = run(root, 'transition', SLUG, '--to', 'shipped');
    expect(r.status).toBe(0);
    expect(stateOf(root).items[SLUG].stage).toBe('shipped');
  });

  it('refuses any transition while awaiting', () => {
    const root = makeRoot();
    prep(root, 'interactive');
    run(root, 'set', SLUG, 'awaiting=blocked:human');
    const r = run(root, 'transition', SLUG, '--to', 'shipped');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/resolve first/);
  });
});

describe('resolve', () => {
  it('clears awaiting with audit trail', () => {
    const root = makeRoot();
    init(root);
    run(root, 'set', SLUG, 'awaiting=user-approval:intent');
    const r = run(root, 'resolve', SLUG, '--note', 'user confirmed scope');
    expect(r.status).toBe(0);
    const item = stateOf(root).items[SLUG];
    expect(item.awaiting).toBeNull();
    expect(item.resolutions[0].flag).toBe('user-approval:intent');
    expect(item.resolutions[0].note).toBe('user confirmed scope');
  });

  it('resets loops when resolving flagged:loop-cap', () => {
    const root = makeRoot();
    init(root);
    writeIntent(root);
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    for (let i = 0; i < 3; i += 1) {
      run(root, 'transition', SLUG, '--to', 'specify');
      run(root, 'transition', SLUG, '--to', 'analyze');
    }
    run(root, 'set', SLUG, 'awaiting=flagged:loop-cap');
    run(root, 'resolve', SLUG, '--note', 'keep current scope');
    expect(stateOf(root).items[SLUG].loops).toBe(0);
  });

  it('refuses when nothing awaiting', () => {
    const root = makeRoot();
    init(root);
    expect(run(root, 'resolve', SLUG, '--note', 'x').status).toBe(1);
  });
});

describe('seed', () => {
  it('refuses with no artifacts', () => {
    const root = makeRoot();
    expect(run(root, 'seed', 'ghost').status).toBe(1);
  });

  it('infers analyze from intent doc', () => {
    const root = makeRoot();
    writeIntent(root);
    expect(run(root, 'seed', SLUG).status).toBe(0);
    expect(stateOf(root).items[SLUG].stage).toBe('analyze');
    expect(stateOf(root).active).toBe(SLUG);
  });

  it('flags flagged:seeded when legacy evidence missing', () => {
    const root = makeRoot();
    writeIntent(root);
    writeSpec(root);
    const r = run(root, 'seed', SLUG);
    expect(r.status).toBe(0);
    const item = stateOf(root).items[SLUG];
    expect(item.stage).toBe('specify');
    expect(item.awaiting).toBe('flagged:seeded');
  });

  it('seeds clean when evidence present', () => {
    const root = makeRoot();
    writeIntent(root);
    writeSpec(root);
    writeReview(root, 'analyze', ['VERDICT: APPROVE']);
    writeReview(root, 'spec', ['VERDICT: APPROVE']);
    run(root, 'seed', SLUG);
    expect(stateOf(root).items[SLUG].awaiting).toBeNull();
  });
});

describe('guards', () => {
  it('refuses writes outside main worktree (.git not a dir)', () => {
    const root = mkdtempSync(join(tmpdir(), 'pstate-wt-'));
    mkdirSync(join(root, 'tasks'), { recursive: true });
    writeFileSync(join(root, '.git'), 'gitdir: /elsewhere\n');
    const r = init(root);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/main worktree/);
  });

  it('exits 1 on corrupt state JSON', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'tasks/pipeline-state.json'), '{not json');
    expect(run(root, 'get', SLUG).status).toBe(1);
    expect(run(root, 'get', SLUG).stderr).toMatch(/corrupt/);
  });
});
