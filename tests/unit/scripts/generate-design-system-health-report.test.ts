import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const jsonPath = join(root, 'docs/design-system/HEALTH_REPORT.json');
const mdPath = join(root, 'docs/design-system/HEALTH_REPORT.md');

describe('generate-design-system-health-report', () => {
  beforeAll(() => {
    execSync('node scripts/generate-design-system-health-report.mjs', {
      cwd: root,
      stdio: 'pipe',
    });
  });

  it('generates a valid JSON health report with expected shape', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const report = JSON.parse(raw) as Record<string, unknown>;

    expect(report.generatedAt).toEqual(expect.any(String));
    expect(report.summary).toEqual(expect.any(Object));
    expect(report.adoption).toEqual(expect.any(Object));
    expect(report.tokenHealth).toEqual(expect.any(Object));
    expect(report.evidence).toEqual(expect.any(Object));
    expect(report.bundle).toEqual(expect.any(Object));
  });

  it('includes a markdown report', async () => {
    const raw = await readFile(mdPath, 'utf-8');
    expect(raw).toContain('Cell Design System Health Report');
    expect(raw).toContain('Shared UI adoption');
    expect(raw).toContain('Token & drift health');
    expect(raw).toContain('Bundle impact');
  });

  it('reports shared UI adoption with non-zero totals and a target', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const report = JSON.parse(raw) as { adoption: { total: number; consumers: number; target: number } };

    expect(report.adoption.total).toBeGreaterThan(0);
    expect(report.adoption.consumers).toBeGreaterThanOrEqual(0);
    expect(report.adoption.target).toBe(0.95);
  });

  it('shows pre-existing undefined-token drift as a deliberate/accepted warning, not a failure', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const report = JSON.parse(raw) as {
      summary: { status: string; failures: string[]; warnings: string[] };
      tokenHealth: { cssAudit: { byRule: Record<string, number> } };
    };

    const undefinedTokenCount = report.tokenHealth.cssAudit.byRule['undefined-token'] ?? 0;
    expect(undefinedTokenCount).toBeGreaterThan(0);
    expect(report.summary.status).toBe('warn');
    expect(report.summary.failures).toEqual([]);
    expect(report.summary.warnings.some((w) => w.includes('undefined-token'))).toBe(true);
  });

  it('flags zero-consumer public UI exports when present', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const report = JSON.parse(raw) as { evidence: { zeroConsumerPublicExports: string[] } };

    expect(Array.isArray(report.evidence.zeroConsumerPublicExports)).toBe(true);
  });

  it('reports bundle sizes when dist artifacts exist', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const report = JSON.parse(raw) as { bundle: { ui: { bytes: number } | null; tokens: { bytes: number } | null } };

    if (report.bundle.ui) {
      expect(report.bundle.ui.bytes).toBeGreaterThan(0);
    }
    if (report.bundle.tokens) {
      expect(report.bundle.tokens.bytes).toBeGreaterThan(0);
    }
  });

  it('has zero M3 token drift in source CSS', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const report = JSON.parse(raw) as { tokenHealth: { drift: { m3FilesCount: number } } };

    expect(report.tokenHealth.drift.m3FilesCount).toBe(0);
  });
});
