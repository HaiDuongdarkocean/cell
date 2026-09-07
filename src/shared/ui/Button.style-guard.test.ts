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

  it('has no backdrop-filter anywhere (solid-only material)', () => {
    expect(css).not.toMatch(/backdrop-filter/);
  });

  it('has no liquid-glass tokens or classes', () => {
    expect(css).not.toMatch(/--button-liquid|--color-glass|--color-liquid|--color-button-liquid|--shadow-liquid/);
    expect(css).not.toMatch(/\.liquid|\.glass|\.solid\b/);
  });
});
