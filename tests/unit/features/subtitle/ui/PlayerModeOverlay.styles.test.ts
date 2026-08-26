import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssPath = resolve(__dirname, '../../../../../src/features/subtitle/ui/PlayerModeOverlay.module.css');
const css = readFileSync(cssPath, 'utf8');

describe('PlayerModeOverlay.module.css', () => {
  it('overlays receive pointer events so wheel/click events reach content', () => {
    expect(css).toMatch(/\.overlay\s*\{[^}]*pointer-events:\s*auto/s);
    expect(css).toMatch(/\.contentOther\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it('slotted player in video stage is interactive', () => {
    expect(css).toMatch(/\.videoStage\s+::slotted\(\[slot=['"]cell-video['"]\]\)\s*\{[^}]*pointer-events:\s*auto/s);
  });

  it('does not use a transparent click-through child-frame overlay', () => {
    // The previous childFrame hack made the overlay transparent and passed
    // pointer events through because the video stayed behind the overlay.
    // Now the player is projected into the video stage, so no special
    // child-frame CSS is needed.
    expect(css).not.toMatch(/\.childFrame/s);
  });

  it('content other wrapper is NOT a scroll container (overflow:hidden — CueList .list is sole scroller)', () => {
    expect(css).toMatch(/\.contentOther\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).not.toMatch(/\.contentOther\s*\{[^}]*overflow-y:\s*auto/s);
  });
});
