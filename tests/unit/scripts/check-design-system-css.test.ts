import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptPath = path.resolve('scripts/check-design-system-css.mjs');
const fixturesPath = path.resolve('tests/unit/scripts/fixtures');

type AuditResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runAudit(target: string): AuditResult {
  const result = spawnSync(process.execPath, [scriptPath, target], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe('check-design-system-css', () => {
  it('passes the good fixture', () => {
    const { status, stdout } = runAudit(
      path.join(fixturesPath, 'css-audit-good.module.css'),
    );
    expect(status).toBe(0);
    expect(stdout).toMatch(/0 violations?/i);
  });

  it('rejects the bad fixture and returns exit code 1', () => {
    const { status } = runAudit(path.join(fixturesPath, 'css-audit-bad.module.css'));
    expect(status).toBe(1);
  });

  it('reports hardcoded color violations', () => {
    const { stdout } = runAudit(path.join(fixturesPath, 'css-audit-bad.module.css'));
    expect(stdout).toMatch(/hardcoded-color/);
    expect(stdout).toMatch(/#ff0000/);
    expect(stdout).toMatch(/rgb\(255 0 0\)/);
    expect(stdout).toMatch(/rgba\(0, 0, 0, 0\.5\)/);
    expect(stdout).toMatch(/hsl\(120 50% 50%\)/);
    expect(stdout).toMatch(/hsla\(120 50% 50% \/ 0\.5\)/);
  });

  it('reports hardcoded spacing violations', () => {
    const { stdout } = runAudit(path.join(fixturesPath, 'css-audit-bad.module.css'));
    expect(stdout).toMatch(/hardcoded-spacing/);
    expect(stdout).toMatch(/\b16px\b/);
    expect(stdout).toMatch(/\b0\.5rem\b/);
    expect(stdout).toMatch(/\b8px\b/);
  });

  it('reports hardcoded radius violations', () => {
    const { stdout } = runAudit(path.join(fixturesPath, 'css-audit-bad.module.css'));
    expect(stdout).toMatch(/hardcoded-radius/);
    expect(stdout).toContain('4px');
    expect(stdout).toContain('10%');
  });

  it('reports hardcoded z-index violations', () => {
    const { stdout } = runAudit(path.join(fixturesPath, 'css-audit-bad.module.css'));
    expect(stdout).toMatch(/hardcoded-z-index/);
    expect(stdout).toContain('100');
  });

  it('reports undefined token violations', () => {
    const { stdout } = runAudit(path.join(fixturesPath, 'css-audit-bad.module.css'));
    expect(stdout).toMatch(/undefined-token/);
    expect(stdout).toMatch(/var\(--not-a-token\)/);
  });

  it('includes file, line, column, rule and snippet in output', () => {
    const { stdout } = runAudit(path.join(fixturesPath, 'css-audit-bad.module.css'));
    // Expect a tab-separated line like: file:line:col rule detail selector snippet
    expect(stdout).toMatch(
      /tests\/unit\/scripts\/fixtures\/css-audit-bad\.module\.css:\d+:\d+\thardcoded-color/,
    );
    expect(stdout).toMatch(/color:\s*#ff0000/);
  });

  it(
    'audits the real src/shared/ui scope in under 5 seconds',
    () => {
      const start = Date.now();
      const { status, stdout } = runAudit('src/shared/ui');
      const elapsed = Date.now() - start;
      expect(stdout).toMatch(/\(\d+ files? checked\)/);
      expect(stdout).toMatch(/\d+ violations?/);
      expect(elapsed).toBeLessThan(5000);
      expect(status === 0 || status === 1).toBe(true);
    },
    30000,
  );
});
