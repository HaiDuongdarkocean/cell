import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptPath = path.resolve('scripts/check-feature-cycles.mjs');
const fixturesRoot = path.resolve('tests/unit/scripts/fixtures/feature-cycles');

type AuditResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runCycleCheck(srcRoot: string): AuditResult {
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

describe('check-feature-cycles', () => {
  it('passes a clean feature DAG', () => {
    const result = runCycleCheck(path.join(fixturesRoot, 'clean/src'));
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/clean/);
  });

  it('detects a two-feature alias+relative cycle', () => {
    const result = runCycleCheck(path.join(fixturesRoot, 'cycle/src'));
    expect(result.status).toBe(1);
    const output = combined(result);
    expect(output).toMatch(/CYCLE/);
    expect(output).toMatch(/a → b → a|b → a → b/);
  });

  it('flags features importing entrypoints via alias and relative paths', () => {
    const result = runCycleCheck(path.join(fixturesRoot, 'violations/src'));
    expect(result.status).toBe(1);
    const output = combined(result);
    expect(output).toMatch(/ENTRYPOINT IMPORT/);
    expect(output).toMatch(/@\/entrypoints\/popup\/main/);
    expect(output).toMatch(/\.\.\/\.\.\/entrypoints\/popup\/main/);
  });

  it('flags stray dirs like src/stores importing entrypoints', () => {
    const result = runCycleCheck(path.join(fixturesRoot, 'stray/src'));
    expect(result.status).toBe(1);
    expect(combined(result)).toMatch(/ENTRYPOINT IMPORT.*stores.legacy\.mjs/);
  });

  it('fails when the features dir is missing', () => {
    const result = runCycleCheck(path.join(fixturesRoot, 'empty/src'));
    expect(result.status).toBe(1);
    expect(combined(result)).toMatch(/features dir not found/);
  });

  it('passes on the real src tree', () => {
    const result = runCycleCheck(path.resolve('src'));
    expect(result.status).toBe(0);
  }, 15000);
});
