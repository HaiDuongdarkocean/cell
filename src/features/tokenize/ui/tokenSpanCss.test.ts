import { describe, expect, it } from '@jest/globals';
import { buildTokenSpanCss, buildTokenSpanCssForShadow } from './tokenSpanCss';

// Regression guard: status bar box-shadow uses calc(var(--border-width-status) * -1).
// On host pages tokens.css is never loaded, so buildTokenSpanCss() must
// inject the resolved static-token values into :root. Without them the
// box-shadow declaration is invalid and the status underline silently
// disappears (while the frequency band, which only uses --cell-token-*
// color vars, still renders).
describe('buildTokenSpanCss — static token injection (status bar visibility)', () => {
  const css = buildTokenSpanCss();

  it('injects the 7 static design tokens needed by token-span CSS into :root', () => {
    const staticTokens = [
      '--space-0-5',
      '--shadow-sm',
      '--border-width-hairline',
      '--border-width-status',
      '--radius-xs',
      '--duration-100',
      '--overlay-text-rgb',
    ];
    for (const name of staticTokens) {
      expect(css).toContain(`${name}:`);
      expect(css).not.toContain(`${name}: ;`);
    }
  });

  it('status bar rule references --border-width-status (the var the resolved value backs)', () => {
    expect(css).toContain('var(--border-width-status)');
  });

  it('injects --border-width-status into every theme block (:root, dark media, light, dark)', () => {
    // 4 occurrences: :root, @media dark, [data-theme="light"], [data-theme="dark"]
    const matches = css.match(/--border-width-status:/g) ?? [];
    expect(matches.length).toBe(4);
  });

  it('injects --overlay-text-rgb (static, theme-independent) into every theme block', () => {
    const matches = css.match(/--overlay-text-rgb:/g) ?? [];
    expect(matches.length).toBe(4);
  });

  // Regression guard: GeeksforGeeks (Next.js) ships a high-specificity
  // box-shadow:none!important reset at (0,2,1) that beat our old (0,2,0)
  // double-class selectors and even (0,2,1) html-prefixed selectors.
  // The fix prefixes box-shadow rules with `html body` to raise specificity
  // to (0,2,2) so host resets cannot override.
  it('status/frequency box-shadow rules use html body ancestor for (0,2,2) specificity', () => {
    expect(css).toContain('html body .js-cell-token.js-cell-token--status-unknown');
    expect(css).toContain('html body .js-cell-token.js-cell-token--frequency-core');
    expect(css).toContain('html body .js-cell-token.js-cell-token--status-off');
  });

  describe('buildTokenSpanCssForShadow — self-contained variables', () => {
    const shadowCss = buildTokenSpanCssForShadow();

    it.each([
      '--cell-token-status-unknown',
      '--cell-token-status-tracking',
      '--cell-token-status-known',
      '--cell-token-status-ignore',
      '--cell-token-freq-core-bg',
      '--cell-token-freq-core-fg',
      '--cell-token-freq-common-bg',
      '--cell-token-freq-common-fg',
      '--cell-token-freq-general-bg',
      '--cell-token-freq-general-fg',
      '--cell-token-freq-advanced-bg',
      '--cell-token-freq-advanced-fg',
      '--cell-token-freq-rare-bg',
      '--cell-token-freq-rare-fg',
      '--cell-token-freq-border',
    ])('declares %s inside the shadow sheet', (name) => {
      expect(shadowCss).toContain(`${name}:`);
    });

    it('scopes declarations to :host and [data-theme] so fullscreen reparenting cannot break them', () => {
      expect(shadowCss).toMatch(/:host\s*\{[^}]*--cell-token-status-unknown:/);
      expect(shadowCss).toMatch(/\[data-theme="dark"\]\s*\{[^}]*--cell-token-status-unknown:/);
      expect(shadowCss).toMatch(/\[data-theme="light"\]\s*\{[^}]*--cell-token-status-unknown:/);
    });
  });

  it.each(['unknown', 'tracking', 'known', 'ignore'])('keeps the %s status underline visible in light and shadow DOM', (status) => {
    for (const source of [buildTokenSpanCss(), buildTokenSpanCssForShadow()]) {
      expect(source).toMatch(new RegExp(`status-${status}[^}]*box-shadow:\\s*inset 0 calc\\(var\\(--border-width-status\\)`));
      expect(source).not.toMatch(new RegExp(`status-${status}[^}]*box-shadow:\\s*var\\(--shadow-sm\\)`));
    }
  });

  it.each(['known', 'ignore'])('gates the %s status underline behind hover or popup-open', (status) => {
    for (const source of [buildTokenSpanCss(), buildTokenSpanCssForShadow()]) {
      expect(source).toMatch(new RegExp(`status-${status}:hover:not\\(\\.js-cell-token--status-off\\)[^}]*box-shadow:\\s*inset 0 calc`));
      expect(source).toMatch(new RegExp(`status-${status}\\.js-cell-token--popup-open:not\\(\\.js-cell-token--status-off\\)[^}]*box-shadow:\\s*inset 0 calc`));
      expect(source).not.toMatch(new RegExp(`status-${status}\\s*\\{[^}]*box-shadow`));
    }
  });

  it.each(['known', 'ignore'])('hides the %s frequency pill until hover or popup-open', (status) => {
    for (const source of [buildTokenSpanCss(), buildTokenSpanCssForShadow()]) {
      expect(source).toMatch(new RegExp(`status-${status}:not\\(:hover\\):not\\(\\.js-cell-token--popup-open\\)[^}]*background-color:\\s*transparent`));
      expect(source).not.toMatch(new RegExp(`status-${status},[^}]*background-color:\\s*transparent`));
    }
  });
});
