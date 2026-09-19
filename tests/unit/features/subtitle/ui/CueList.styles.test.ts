import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssPath = resolve(__dirname, '../../../../../src/features/subtitle/ui/CueList.module.css');
const css = readFileSync(cssPath, 'utf8');

describe('CueList.module.css', () => {
  it('desynced bottom padding outranks the mobile .list padding shorthand (pill must not cover last cue)', () => {
    const desynced = css.match(/\.list\.listDesynced\s*\{[^}]*padding-bottom:\s*calc\(var\(--touch-target\)\s*\+\s*var\(--space-4\)\)/s);
    expect(desynced).not.toBeNull();
  });

  it('scroller disables browser scroll anchoring (re-anchors must not masquerade as user scroll)', () => {
    expect(css).toMatch(/\.list\s*\{[^}]*overflow-anchor:\s*none/s);
  });
});
