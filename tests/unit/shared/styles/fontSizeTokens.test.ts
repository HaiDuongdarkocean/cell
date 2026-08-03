import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * ADR-076 regression guard: font-size tokens MUST use absolute units (px),
 * never `rem`. `rem` resolves against the host page <html> font-size, which
 * leaks into every shadow-root overlay (popup dictionary, universal panel,
 * orbital badge, tokenize FAB). If someone reverts to `rem`, this test fails.
 */
describe('ADR-076: font-size tokens are host-independent', () => {
  let tokensJson: string;

  beforeAll(async () => {
    tokensJson = await readFile(
      join(__dirname, '../../../../src/shared/styles/tokens.json'),
      'utf8',
    );
  });

  it('font.sizes values contain no `rem` units', () => {
    const parsed = JSON.parse(tokensJson) as { static: { font: { sizes: Record<string, string> } } };
    const sizes = parsed.static.font.sizes;
    const remEntries = Object.entries(sizes).filter(([, v]) => /rem\b/.test(v));
    expect(remEntries).toEqual([]);
  });

  it('components.css has a `:host` font-size reset', async () => {
    const css = await readFile(
      join(__dirname, '../../../../src/shared/styles/components.css'),
      'utf8',
    );
    expect(css).toMatch(/:host\s*\{\s*font-size:\s*var\(--font-size-base\)/);
  });
});
