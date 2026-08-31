import { readFileSync } from 'fs';
import { resolve } from 'path';

const cssPath = resolve(process.cwd(), 'src/shared/ui/Button.module.css');
const css = readFileSync(cssPath, 'utf8');

describe('Button style contract guard', () => {
  it('has no idle drift animation', () => {
    expect(css).not.toMatch(/animation:\s*liquidDrift/);
    expect(css).not.toMatch(/@keyframes\s+liquidDrift/);
  });

  it('has no hover lift transform', () => {
    const hoverBlocks = css.match(/:hover\s*\{[^{}]*\}/g) ?? [];
    for (const block of hoverBlocks) {
      expect(block).not.toMatch(/translateY|translate3d/);
    }
  });

  it('forces zero border-radius for solid vertical and full-width buttons', () => {
    const block = css.match(/\.solid\.(?:vertical|fullWidth)\s*\{[^{}]*\}/)?.[0] ?? '';
    expect(block).toMatch(/border-radius\s*:\s*0\b/);
  });

  it('has no semantic color fill on liquid/glass variants', () => {
    const prominentBlock = css.match(/\.liquidProminent\s*\{[^{}]*\}/)?.[0] ?? '';
    // Prominent must not be a solid primary fill; it must use a neutral token.
    expect(prominentBlock).not.toMatch(/background-color:\s*var\(--color-primary\)/);
  });

  it('removes backdrop filter on solid variant', () => {
    const solidBlock = css.match(/\.solid\s*\{[^{}]*\}/)?.[0] ?? '';
    expect(solidBlock).toMatch(/backdrop-filter\s*:\s*none/);
    expect(solidBlock).toMatch(/-webkit-backdrop-filter\s*:\s*none/);
  });
});
