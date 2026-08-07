import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssPath = resolve(__dirname, '../../../../../src/features/subtitle/ui/PlayerModeOverlay.module.css');
const css = readFileSync(cssPath, 'utf8');

describe('PlayerModeOverlay.module.css', () => {
  it('overlays receive pointer events so wheel/click events reach content', () => {
    expect(css).toMatch(/\.overlay\s*\{[^}]*pointer-events:\s*auto/s);
    expect(css).toMatch(/\.contentOther\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it('cue list wrapper is independently scrollable', () => {
    expect(css).toMatch(/\.cueListWrap\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/\.cueListWrap\s*\{[^}]*overscroll-behavior:\s*contain/s);
  });
});
