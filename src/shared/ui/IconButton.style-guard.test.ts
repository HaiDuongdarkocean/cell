import { readFileSync } from 'fs';
import { resolve } from 'path';

const cssPath = resolve(process.cwd(), 'src/shared/ui/IconButton.module.css');
const css = readFileSync(cssPath, 'utf8');

describe('IconButton style contract guard', () => {
  it('has no idle drift animation', () => {
    const animationRules = css.match(/animation\s*:\s*[^;]+/g) ?? [];
    for (const rule of animationRules) {
      expect(rule).toMatch(/:\s*none\s*$/);
    }
    expect(css).not.toMatch(/@keyframes\s+\w+/);
  });

  it('has no hover lift transform', () => {
    const hoverBlocks = css.match(/:hover\s*\{[^{}]*\}/g) ?? [];
    for (const block of hoverBlocks) {
      expect(block).not.toMatch(/translateY|translate3d/);
    }
  });

  it('is circular at every size', () => {
    const iconBtnBlock = css.match(/\.iconBtn\s*\{[^{}]*\}/)?.[0] ?? '';
    expect(iconBtnBlock).toMatch(/border-radius\s*:\s*var\(--iconbutton-radius\)/);
    // --iconbutton-radius resolves to var(--radius-full) (9999px) in tokens.json.
  });

  it('sizes enforce equal width and height', () => {
    for (const size of ['xs', 'sm', 'md', 'lg']) {
      const block = css.match(new RegExp(`\\.${size}\\s*\\{[^{}]*\\}`))?.[0] ?? '';
      const width = block.match(/width\s*:\s*([^;]+)/)?.[1] ?? '';
      const height = block.match(/height\s*:\s*([^;]+)/)?.[1] ?? '';
      expect(width).toBeTruthy();
      expect(height).toBeTruthy();
      expect(width).toBe(height);
    }
  });
});
