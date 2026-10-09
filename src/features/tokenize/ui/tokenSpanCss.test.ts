import { describe, expect, it } from '@jest/globals';
import { buildTokenSpanCss, buildTokenSpanCssForShadow } from './tokenSpanCss';

// Regression guard: the status capsule height uses var(--border-width-status).
// On host pages tokens.css is never loaded, so buildTokenSpanCss() must
// inject the resolved static-token values into :root. Without them the
// height declaration is invalid and the status capsule silently collapses
// (while the frequency band, which only uses --cell-token-* color vars,
// still renders).
describe('buildTokenSpanCss — static token injection (status bar visibility)', () => {
  const css = buildTokenSpanCss();

  it('injects the 6 static design tokens needed by token-span CSS into :root', () => {
    const staticTokens = [
      '--space-0-5',
      '--shadow-sm',
      '--border-width-hairline',
      '--border-width-status',
      '--radius-md',
      '--duration-100',
    ];
    for (const name of staticTokens) {
      expect(css).toContain(`${name}:`);
      expect(css).not.toContain(`${name}: ;`);
    }
  });

  it('status capsule references --border-width-status (the var the resolved value backs)', () => {
    expect(css).toContain('height: var(--border-width-status)');
  });

  it('injects --border-width-status into every theme block (:root, dark media, light, dark)', () => {
    // 4 occurrences: :root, @media dark, [data-theme="light"], [data-theme="dark"]
    const matches = css.match(/--border-width-status:/g) ?? [];
    expect(matches.length).toBe(4);
  });

  // Regression guard: GeeksforGeeks (Next.js) ships a high-specificity
  // box-shadow:none!important reset at (0,2,1) that beat our old (0,2,0)
  // double-class selectors and even (0,2,1) html-prefixed selectors.
  // The fix prefixes status/frequency rules with `html body` to raise
  // specificity to (0,2,2) so host resets cannot override.
  it('status/frequency rules use html body ancestor for (0,2,2) specificity', () => {
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

  it.each(['host', 'shadow'])('keeps the %s status capsule in-flow and rounded', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const bar = source.match(/\.js-cell-token-status\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bar).toContain('display: block');
    expect(bar).toContain('width: 100%');
    expect(bar).toContain('height: var(--border-width-status)');
    expect(bar).toContain('border-radius: 999px');
    expect(bar).toContain('background: transparent');
  });

  it.each(['unknown', 'tracking', 'known', 'ignore'])(
    'paints the %s status capsule with a single color layer — no halo',
    (status) => {
      for (const source of [buildTokenSpanCss(), buildTokenSpanCssForShadow()]) {
        const rule = source.match(
          new RegExp(`status-${status}[^{]*\\{([^}]*)\\}`, 'g'),
        )?.find((r) => r.includes('js-cell-token-status'));
        expect(rule).toBeDefined();
        expect(rule).toContain(`background: var(--cell-token-status-${status})`);
        expect(rule).not.toContain('box-shadow');
        expect(rule).not.toContain('overlay-text-rgb');
      }
    },
  );

  it.each(['known', 'ignore'])('gates the %s status capsule behind hover or popup-open', (status) => {
    for (const source of [buildTokenSpanCss(), buildTokenSpanCssForShadow()]) {
      expect(source).toMatch(
        new RegExp(`status-${status}:hover:not\\(\\.js-cell-token--status-off\\) \\.js-cell-token-status[^}]*background:\\s*var\\(--cell-token-status-${status}\\)`),
      );
      expect(source).toMatch(
        new RegExp(`status-${status}\\.js-cell-token--popup-open:not\\(\\.js-cell-token--status-off\\) \\.js-cell-token-status[^}]*background:\\s*var\\(--cell-token-status-${status}\\)`),
      );
    }
  });

  it.each(['known', 'ignore'])('strips the %s frequency pill unconditionally (hover reveals only the status bar)', (status) => {
    for (const source of [buildTokenSpanCss(), buildTokenSpanCssForShadow()]) {
      const rules = [...source.matchAll(new RegExp(`status-${status}[^;{]*\\{[^}]*\\}`, 'g'))].map((m) => m[0]);
      const match = rules.find((r) => r.includes('padding: 0')) ?? '';
      expect(match).not.toContain(':hover');
      expect(match).not.toContain('popup-open');
      expect(match).toContain('background-color: transparent');
      expect(match).toContain('box-shadow: none');
      expect(match).toContain('border-radius: 0');
      // The pill must never come back on hover/popup-open — only the status
      // capsule is gated behind those states (see the gating test above).
      expect(source).not.toMatch(
        new RegExp(`status-${status}:(?:hover|\\.)[^,{]*\\{[^}]*background-color:\\s*var\\(--cell-token-freq`),
      );
    }
  });

  it.each(['host', 'shadow'])('gates the pill and status capsule behind i+1 in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const rule = source.match(/\.js-cell-token--i1-off\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('background-color: transparent');
    expect(rule).toContain('box-shadow: none');
    expect(rule).toContain('padding: 0');
    expect(rule).toContain('border-radius: 0');
    // i1-off hides the capsule at rest, but hover or an open dictionary popup
    // must reveal it — otherwise a clicked word can never show its status.
    expect(source).toMatch(
      /\.js-cell-token--i1-off:not\(:hover\):not\(\.js-cell-token--popup-open\) \.js-cell-token-status\s*\{[^}]*background:\s*transparent/,
    );
    // The gate must sit after the frequency/status paint rules so equal
    // specificity resolves in its favour.
    expect(source.indexOf('.js-cell-token--i1-off')).toBeGreaterThan(source.indexOf('frequency-rare {'));
  });

  it.each(['host', 'shadow'])('paints the sentence wash as flat band overlays in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    // Per-token --sentence backgrounds could never produce straight edges —
    // the wash is one snapped overlay rect per line (see sentenceHighlight.ts).
    expect(source).toMatch(
      /\.js-cell-sentence-band\s*\{[^}]*mix-blend-mode:\s*multiply[^}]*color-mix\(in srgb, var\(--cell-token-selected\) 22%/,
    );
    expect(source).not.toContain('.js-cell-token--sentence .js-cell-token-word');
    expect(source).not.toContain('--separator.js-cell-token--sentence');
  });

  it.each(['host', 'shadow'])('frequency pill wraps the whole column in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    // Pill background + padding + radius target the token column itself, not
    // the inner word lane, so the box encloses cap + word + status + gloss.
    expect(source).toMatch(/frequency-core\s*\{[^}]*background-color:\s*var\(--cell-token-freq-core-bg\)/);
    expect(source).toMatch(/frequency-rare\s*\{[^}]*padding:\s*0\.15em 0\.3em/);
    expect(source).toMatch(/frequency-rare\s*\{[^}]*border-radius:\s*var\(--radius-md\)/);
    expect(source).toMatch(/frequency-rare\s*\{[^}]*box-shadow:\s*inset 0 0 0 var\(--border-width-hairline\)/);
    expect(source).not.toMatch(/frequency-\w+ \.js-cell-token-word\s*\{[^}]*background-color/);
  });

  it.each(['host', 'shadow'])('keeps the word lane transparent and unpainted in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const lane = source.match(/\.js-cell-token-word\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(lane).toContain('line-height: 1.1');
    expect(lane).toContain('background: transparent');
    expect(lane).not.toContain('box-shadow');
  });

  it.each(['host', 'shadow'])('blocks host padding/border/margin leakage into token lanes in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    for (const sel of ['.js-cell-token--word {', '.js-cell-token-word {', '.js-cell-token-status {']) {
      const body = source.match(new RegExp(sel.replace(/[.{}]/g, (c) => `\\${c}`) + '([^}]*)\\}'))?.[1] ?? '';
      expect(body).toContain('padding: 0');
      expect(body).toContain('border: 0');
    }
    const status = source.match(/\.js-cell-token-status\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(status).toContain('margin: 0');
  });

  it.each(['host', 'shadow'])('spaces the annotation stack by column gap alone in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const column = source.match(/\.js-cell-token--word\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(column).toContain('gap: 0.14em');
    expect(column).toContain('margin: 0.55em 0');
    expect(source).toMatch(/vertical-align:\s*1\.19em/);
    expect(source).not.toMatch(/\.js-cell-token-word\s*\{[^}]*padding-bottom/);
    expect(source).not.toMatch(/::after\s*\{[^}]*margin-top/);
  });

  it.each(['host', 'shadow'])('sizes reading and gloss lanes at 0.62em in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const cap = source.match(/reading-off\)::before\s*\{([^}]*)\}/)?.[1] ?? '';
    const gloss = source.match(/gloss-off\)::after\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(cap).toContain('font-size: 0.62em');
    expect(gloss).toContain('font-size: 0.62em');
  });

  it.each(['host', 'shadow'])('annotation lanes inherit the word style (color/italic/weight) in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    for (const lane of [/(reading-off\)::before\s*\{([^}]*)\})/, /(gloss-off\)::after\s*\{([^}]*)\})/]) {
      const body = source.match(lane)?.[1] ?? '';
      expect(body).toContain('font-style: inherit');
      expect(body).toContain('font-weight: inherit');
      expect(body).toContain('color: inherit');
    }
  });

  it.each(['host', 'shadow'])('emits self-contained --cell-token-* values in %s CSS (no unresolved var(--color-text))', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const values = [...source.matchAll(/--cell-token-[\w-]+:\s*([^;]+);/g)].map((match) => match[1]);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).not.toContain('var(--color-text)');
    }
  });

  it('pins every --cell-token-* selector to the light palette (tokens never flip dark)', () => {
    const darkBlock = buildTokenSpanCss().split('[data-theme="dark"]')[1];
    expect(darkBlock).toContain('--cell-token-selected: #5E6AD2'); // light primary
    expect(darkBlock).not.toContain('#6AB2F5'); // dark primary never emitted
  });

  it('keeps a line box in the empty cap lane so missing readings never lift the word', () => {
    for (const source of [buildTokenSpanCss(), buildTokenSpanCssForShadow()]) {
      const cap = source.match(/reading-off\)::before\s*\{([^}]*)\}/)?.[1] ?? '';
      expect(cap).toContain("content: attr(data-reading) '\\200B'");
      expect(cap).toContain('min-height:');
    }
  });
});
