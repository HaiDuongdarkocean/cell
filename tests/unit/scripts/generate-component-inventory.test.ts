import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const jsonPath = join(root, 'docs/design-system/COMPONENT_INVENTORY.json');

describe('generate-component-inventory', () => {
  beforeAll(() => {
    execSync('node scripts/generate-component-inventory.mjs', {
      cwd: root,
      stdio: 'pipe',
    });
  });

  it('generates a valid JSON inventory with expected shape', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const inventory = JSON.parse(raw) as Record<string, unknown>;

    expect(inventory.generatedAt).toEqual(expect.any(String));
    expect(inventory.summary).toEqual(expect.any(Object));
    expect(inventory.publicExports).toEqual(expect.any(Array));
    expect(inventory.nonPublicComponents).toEqual(expect.any(Array));
    expect(inventory.gaps).toEqual(expect.any(Object));

    const summary = inventory.summary as Record<string, number>;
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.public).toBeGreaterThan(0);
    expect(summary.stable).toBeGreaterThanOrEqual(0);
  });

  it('flags known non-public gaps (BottomSheet, Sheet)', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const inventory = JSON.parse(raw) as { gaps: Record<string, string[]> };

    expect(inventory.gaps.missingShowcase).toContain('BottomSheet');
    expect(inventory.gaps.missingShowcase).toContain('Sheet');
  });

  it('surfaces ErrorBoundary as public but without consumer (zero-consumer)', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const inventory = JSON.parse(raw) as { publicExports: Array<{ name: string; status: string }> };

    const errorBoundary = inventory.publicExports.find((e) => e.name === 'ErrorBoundary');
    expect(errorBoundary).toBeDefined();
    // ErrorBoundary is public, hidden, and has no production consumer; it should not be "stable".
    expect(errorBoundary?.status).not.toBe('stable');
  });

  it('detects orphan token showcases that are not real components', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const inventory = JSON.parse(raw) as { gaps: Record<string, string[]> };

    expect(inventory.gaps.orphanShowcases.length).toBeGreaterThan(0);
    expect(inventory.gaps.orphanShowcases).toContain('ColorScale');
  });

  it('marks Button, Input, Select, Tabs as stable with consumers', async () => {
    const raw = await readFile(jsonPath, 'utf-8');
    const inventory = JSON.parse(raw) as { publicExports: Array<{ name: string; status: string; usageCount: number }> };

    const stable = ['Button', 'Input', 'Select', 'Tabs'];
    for (const name of stable) {
      const entry = inventory.publicExports.find((e) => e.name === name);
      expect(entry).toBeDefined();
      expect(entry?.status).toBe('stable');
      expect(entry?.usageCount).toBeGreaterThan(0);
    }
  });
});
