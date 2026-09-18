import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '../../../scripts/check-design-brief.mjs');
const SLUG = 'feat-x';

type Result = { status: number | null; stdout: string; stderr: string };

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'cbrief-'));
  mkdirSync(join(root, 'src/shared/styles'), { recursive: true });
  mkdirSync(join(root, 'src/shared/ui'), { recursive: true });
  mkdirSync(join(root, 'src/shared/icons'), { recursive: true });
  mkdirSync(join(root, 'docs/intent'), { recursive: true });
  writeFileSync(
    join(root, 'src/shared/styles/tokens.json'),
    JSON.stringify({
      derived: { light: { 'color-text-primary': '#000', 'color-surface-elevated': '#fff' } },
      static: { 'space-md': '8px' },
    }),
  );
  for (const c of ['Button', 'Card', 'Badge.showcase', 'Old.test']) {
    writeFileSync(join(root, 'src/shared/ui', `${c}.tsx`), 'export {};\n');
  }
  writeFileSync(
    join(root, 'src/shared/icons/index.ts'),
    `export const ICON_CATALOG = {\n  play: {},\n  check: {},\n  x: {},\n};\n`,
  );
  return root;
}

function writeBrief(root: string, body: string) {
  writeFileSync(join(root, 'docs/intent', `${SLUG}-design-brief.md`), body);
}

function writeMapping(root: string, body: string) {
  writeFileSync(join(root, 'docs/intent', `${SLUG}-component-mapping.md`), body);
}

function run(root: string, ...args: string[]): Result {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const GOOD_BRIEF = `# Design Brief

Surface uses --color-surface-elevated and text --color-text-primary.
Spacing --space-md. Icon: play.
`;

const GOOD_MAPPING = `# Component Mapping

| Element | Component | Token |
| trigger | Button | --color-text-primary |
| panel | Card | --color-surface-elevated |

Icon: check
`;

describe('check-design-brief', () => {
  it('passes when every reference resolves', () => {
    const root = makeRoot();
    writeBrief(root, GOOD_BRIEF);
    writeMapping(root, GOOD_MAPPING);
    const r = run(root, SLUG);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/VERDICT: PASS/);
  });

  it('fails on missing token', () => {
    const root = makeRoot();
    writeBrief(root, `${GOOD_BRIEF}\nUses --color-bogus-token.\n`);
    writeMapping(root, GOOD_MAPPING);
    const r = run(root, SLUG);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/color-bogus-token/);
    expect(r.stdout).toMatch(/VERDICT: FAIL/);
  });

  it('fails on missing component', () => {
    const root = makeRoot();
    writeBrief(root, GOOD_BRIEF);
    writeMapping(root, `${GOOD_MAPPING}\nComponent: FlyingWidget\n`);
    const r = run(root, SLUG);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/FlyingWidget/);
  });

  it('fails on missing icon', () => {
    const root = makeRoot();
    writeBrief(root, `${GOOD_BRIEF}\nIcon: teleport\n`);
    writeMapping(root, GOOD_MAPPING);
    const r = run(root, SLUG);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/teleport/);
  });

  it('resolves dot-path token references', () => {
    const root = makeRoot();
    writeBrief(root, `${GOOD_BRIEF}\nToken \`derived.light.color-text-primary\`.\n`);
    writeMapping(root, GOOD_MAPPING);
    expect(run(root, SLUG).status).toBe(0);
    writeBrief(root, `${GOOD_BRIEF}\nToken \`derived.light.color-nope\`.\n`);
    expect(run(root, SLUG).status).toBe(1);
  });

  it('brief-only mode skips the mapping file', () => {
    const root = makeRoot();
    writeBrief(root, GOOD_BRIEF);
    const r = run(root, SLUG, '--brief-only');
    expect(r.status).toBe(0);
  });

  it('fails when mapping missing without brief-only', () => {
    const root = makeRoot();
    writeBrief(root, GOOD_BRIEF);
    const r = run(root, SLUG);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/component mapping/);
  });

  it('fails when brief missing', () => {
    const root = makeRoot();
    writeMapping(root, GOOD_MAPPING);
    const r = run(root, SLUG);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/design brief/);
  });
});
