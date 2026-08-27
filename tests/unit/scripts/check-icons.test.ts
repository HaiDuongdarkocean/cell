import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptPath = path.resolve('scripts/check-icons.js');
const fixturesRoot = path.resolve('tests/unit/scripts/fixtures/icons');

type AuditResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runIconAudit(svgDir: string, catalogPath: string): AuditResult {
  const result = spawnSync(process.execPath, [scriptPath, svgDir, catalogPath], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function combined(result: AuditResult): string {
  return `${result.stdout}\n${result.stderr}`;
}

describe('check-icons', () => {
  it('passes a good fixture', () => {
    const result = runIconAudit(
      path.join(fixturesRoot, 'good/svg'),
      path.join(fixturesRoot, 'good/catalog.ts'),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/1 icon.*pass/i);
  });

  it('fails a bad viewBox fixture', () => {
    const result = runIconAudit(
      path.join(fixturesRoot, 'bad-viewbox/svg'),
      path.join(fixturesRoot, 'bad-viewbox/catalog.ts'),
    );
    expect(result.status).toBe(1);
    expect(combined(result)).toMatch(/viewBox/);
  });

  it('flags a missing catalog entry', () => {
    const result = runIconAudit(
      path.join(fixturesRoot, 'missing/svg'),
      path.join(fixturesRoot, 'missing/catalog.ts'),
    );
    expect(result.status).toBe(1);
    const output = combined(result);
    expect(output).toMatch(/Missing catalog entry/);
    expect(output).toMatch(/missing-from-catalog\.svg/);
  });

  it('flags duplicate SVG content', () => {
    const result = runIconAudit(
      path.join(fixturesRoot, 'duplicate/svg'),
      path.join(fixturesRoot, 'duplicate/catalog.ts'),
    );
    expect(result.status).toBe(1);
    const output = combined(result);
    expect(output).toMatch(/Duplicate SVG content/);
    expect(output).toMatch(/duplicate-a\.svg/);
    expect(output).toMatch(/duplicate-b\.svg/);
  });

  it('flags a dead catalog entry', () => {
    const result = runIconAudit(
      path.join(fixturesRoot, 'dead/svg'),
      path.join(fixturesRoot, 'dead/catalog.ts'),
    );
    expect(result.status).toBe(1);
    const output = combined(result);
    expect(output).toMatch(/Dead catalog entry/);
    expect(output).toMatch(/ghost/);
  });

  it('flags empty tags in a catalog entry', () => {
    const result = runIconAudit(
      path.join(fixturesRoot, 'empty-tags/svg'),
      path.join(fixturesRoot, 'empty-tags/catalog.ts'),
    );
    expect(result.status).toBe(1);
    const output = combined(result);
    expect(output).toMatch(/Empty tags/);
  });

  it('audits the real icon set in under 5 seconds', () => {
    const start = Date.now();
    const result = runIconAudit(
      path.resolve('src/shared/icons/svg'),
      path.resolve('src/shared/icons/index.ts'),
    );
    const elapsed = Date.now() - start;
    const output = combined(result);
    expect(output).toMatch(/(All \d+ icons pass|Checked \d+ SVG)/i);
    expect(output).toMatch(/(catalog|QC checks)/i);
    expect(elapsed).toBeLessThan(5000);
    expect(result.status === 0 || result.status === 1).toBe(true);
  }, 10000);
});
