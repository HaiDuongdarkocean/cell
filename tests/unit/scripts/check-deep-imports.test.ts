import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptPath = path.resolve('scripts/check-deep-imports.mjs');
const fixturesRoot = path.resolve('tests/unit/scripts/fixtures/deep-imports');

type AuditResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runDeepImportCheck(srcRoot: string): AuditResult {
  const result = spawnSync(process.execPath, [scriptPath, srcRoot], {
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

describe('check-deep-imports', () => {
  it('passes a tree with only barrel and same-feature imports', () => {
    const result = runDeepImportCheck(path.join(fixturesRoot, 'clean/src'));
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/clean/);
  });

  it('fails on new deep imports missing from the baseline', () => {
    const result = runDeepImportCheck(path.join(fixturesRoot, 'new-violation/src'));
    expect(result.status).toBe(1);
    const output = combined(result);
    expect(output).toMatch(/DEEP IMPORT.*features\/a\/index\.mjs → '\.\.\/b\/inner\/deep2\.mjs'/);
    expect(output).not.toMatch(/DEEP IMPORT.*@\/features\/b\/inner\/deep\.mjs/);
  });

  it('nudges stale baseline entries without failing', () => {
    const result = runDeepImportCheck(path.join(fixturesRoot, 'stale-only/src'));
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/STALE BASELINE.*@\/features\/b\/inner\/old\.mjs/);
  });

  it('fails when the baseline file is missing', () => {
    const result = runDeepImportCheck(path.join(fixturesRoot, 'no-baseline/src'));
    expect(result.status).toBe(1);
    expect(combined(result)).toMatch(/baseline not found/);
  });

  it('passes on the real src tree', () => {
    const result = runDeepImportCheck(path.resolve('src'));
    expect(result.status).toBe(0);
  }, 15000);
});
