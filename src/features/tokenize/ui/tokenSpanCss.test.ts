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

  it('injects the 9 static design tokens needed by token-span CSS into :root', () => {
    const staticTokens = [
      '--space-0-5',
      '--space-1',
      '--space-1-5',
      '--space-2',
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

  it.each(['host', 'shadow'])('keeps the %s status capsule rounded and transparent until painted', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const bar = source.match(/\.js-cell-token-status\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bar).toContain('display: block');
    expect(bar).toContain('height: var(--border-width-status)');
    expect(bar).toContain('border-radius: 999px');
    expect(bar).toContain('background: transparent');
  });

  it('keeps the shadow status capsule in-flow at full lane width', () => {
    const bar = buildTokenSpanCssForShadow().match(/\.js-cell-token-status\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bar).toContain('width: 100%');
  });

  it('pins the host status capsule out of flow, tracking the pill padding vars', () => {
    const bar = buildTokenSpanCss().match(/\.js-cell-token-status\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bar).toContain('position: absolute');
    expect(bar).toContain('top: calc(100% + var(--space-0-5))');
    expect(bar).toContain('left: var(--cell-token-pill-pad-x, 0px)');
    expect(bar).toContain('right: var(--cell-token-pill-pad-x, 0px)');
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

  it.each(['host', 'shadow'])('gates the frequency pill but not the status capsule behind i+1 in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const rule = source.match(/\.js-cell-token--i1-off[^{]*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('background-color: transparent');
    expect(rule).toContain('box-shadow: none');
    expect(rule).toContain('padding: 0');
    expect(rule).toContain('border-radius: 0');
    // --i1-off strips the pill chrome only; the status capsule stays visible
    // for every still-new token, so no rule may blank it.
    expect(source).not.toMatch(/--i1-off[^{}]*\.js-cell-token-status\s*\{[^}]*background:\s*transparent/);
    // The gate must sit after the frequency/status paint rules so equal
    // specificity resolves in its favour.
    expect(source.indexOf('.js-cell-token--i1-off')).toBeGreaterThan(source.indexOf('frequency-rare {'));
  });

  it.each(['host', 'shadow'])('washes the whole sentence on hover in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    // The separator keeps a flat background-color; the word lane layers the
    // wash as background-image in the host CSS so it composes over the
    // frequency pill background instead of replacing it.
    if (variant === 'host') {
      expect(source).toMatch(
        /\.js-cell-token--sentence \.js-cell-token-word\s*\{[^}]*background-image:\s*linear-gradient\(color-mix\(in srgb, var\(--cell-token-selected\) 22%/,
      );
    } else {
      expect(source).toMatch(
        /\.js-cell-token--sentence \.js-cell-token-word,\s*[^}]*\.js-cell-token--separator\.js-cell-token--sentence\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--cell-token-selected\)/,
      );
    }
    expect(source).toMatch(
      /\.js-cell-token--separator\.js-cell-token--sentence\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--cell-token-selected\)/,
    );
  });

  it.each(['host', 'shadow'])('frequency pill chrome placement in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    if (variant === 'host') {
      // Host: pill chrome targets the word lane inside the ruby wrapper so
      // the pill hugs the word while the ruby base stays annotation-wide.
      expect(source).toMatch(
        /frequency-core > \.js-cell-token-ruby > \.js-cell-token-word\s*\{[^}]*background-color:\s*var\(--cell-token-freq-core-bg\)/,
      );
      expect(source).toMatch(
        /frequency-rare > \.js-cell-token-ruby > \.js-cell-token-word[^}]*\{[^}]*border-radius:\s*var\(--radius-md\)/,
      );
      expect(source).toMatch(
        /frequency-rare > \.js-cell-token-ruby > \.js-cell-token-word[^}]*\{[^}]*box-shadow:\s*inset 0 0 0 var\(--border-width-hairline\)/,
      );
      // The token keeps only the band fg so ruby-text annotations inherit it.
      expect(source).toMatch(/frequency-core\s*\{[^}]*color:\s*var\(--cell-token-freq-core-fg\)/);
      expect(source).not.toMatch(/frequency-core\s*\{[^}]*background-color/);
    } else {
      // Shadow: pill background + padding + radius stay on the token itself,
      // so the box encloses the word and its in-flow annotation lanes.
      expect(source).toMatch(/frequency-core\s*\{[^}]*background-color:\s*var\(--cell-token-freq-core-bg\)/);
      expect(source).toMatch(/frequency-rare\s*\{[^}]*border-radius:\s*var\(--radius-md\)/);
      expect(source).toMatch(/frequency-rare\s*\{[^}]*box-shadow:\s*inset 0 0 0 var\(--border-width-hairline\)/);
      expect(source).not.toMatch(/frequency-\w+ \.js-cell-token-word\s*\{[^}]*background-color/);
    }
  });

  it('drives the host pill padding from --cell-token-pill-pad-x/y vars on the word lane', () => {
    const source = buildTokenSpanCss();
    const pill = source.match(/frequency-rare > \.js-cell-token-ruby > \.js-cell-token-word[^}]*\{([^}]*)\}/)?.[1] ?? '';
    expect(pill).toContain('--cell-token-pill-pad-x: 0.3em');
    expect(pill).toContain('--cell-token-pill-pad-y: 0.15');
    expect(pill).toContain('padding: calc(var(--cell-token-pill-pad-y) * 1em) var(--cell-token-pill-pad-x)');
  });

  it('keeps the shadow pill padding at 0.15em 0.3em', () => {
    expect(buildTokenSpanCssForShadow()).toMatch(/frequency-rare\s*\{[^}]*padding:\s*0\.15em 0\.3em/);
  });

  it.each(['known', 'ignore'])('zeros the host pill pad vars when the %s pill is stripped', (status) => {
    const source = buildTokenSpanCss();
    const rules = [...source.matchAll(new RegExp(`status-${status}[^;{]*\\{[^}]*\\}`, 'g'))].map((m) => m[0]);
    const match = rules.find((r) => r.includes('padding: 0')) ?? '';
    expect(match).toContain('--cell-token-pill-pad-x: 0px');
    expect(match).toContain('--cell-token-pill-pad-y: 0');
  });

  it.each(['i1-off', 'frequency-off'])('zeros the host pill pad vars for %s', (cls) => {
    const rule = buildTokenSpanCss().match(new RegExp(`${cls}[^{]*\\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule).toContain('--cell-token-pill-pad-x: 0px');
    expect(rule).toContain('--cell-token-pill-pad-y: 0');
  });

  it.each(['host', 'shadow'])('keeps the word lane transparent and unpainted in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const lane = source.match(/\.js-cell-token-word\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(lane).toContain('line-height:');
    expect(lane).toContain('background: transparent');
    expect(lane).not.toContain('box-shadow');
  });

  it('inherits host line-height on the word lane and anchors the status bar inside it', () => {
    const source = buildTokenSpanCss();
    const lane = source.match(/\.js-cell-token-word\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(lane).toContain('line-height: inherit');
    expect(lane).toContain('position: relative');
    // Annotation room comes from padding on the ruby-text boxes, not from a
    // reserved line-height on the lane.
    expect(source).not.toContain('line-height: 3.4');
  });

  it('keeps the shadow word lane at line-height 1.1', () => {
    const lane = buildTokenSpanCssForShadow().match(/\.js-cell-token-word\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(lane).toContain('line-height: 1.1');
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

  it('makes host tokens native ruby containers (token under gloss, nested ruby over IPA)', () => {
    const source = buildTokenSpanCss();
    const token = source.match(/\.js-cell-token\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(token).toContain('display: ruby !important');
    expect(token).toContain('ruby-position: under !important');
    const word = source.match(/\.js-cell-token--word\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(word).toContain('display: ruby !important');
    const ruby = source.match(/\.js-cell-token-ruby\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(ruby).toContain('display: ruby !important');
    expect(ruby).toContain('ruby-position: over !important');
    // No column layout and no baseline lift on the host variant.
    expect(word).not.toContain('inline-flex');
    expect(word).not.toContain('gap:');
    expect(word).not.toContain('margin:');
    expect(source).not.toMatch(/vertical-align:\s*1\.05em/);
    expect(source).not.toMatch(/\.js-cell-token-word\s*\{[^}]*padding-bottom/);
    expect(source).not.toMatch(/::after\s*\{[^}]*margin-top/);
  });

  it('collapses the ruby wrapper inside the shadow column (display: contents)', () => {
    const ruby = buildTokenSpanCssForShadow().match(/\.js-cell-token-ruby\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(ruby).toContain('display: contents !important');
    expect(ruby).not.toContain('ruby-position');
  });

  it('keeps the shadow word token an in-flow column lifted by the cap lane', () => {
    const source = buildTokenSpanCssForShadow();
    const column = source.match(/\.js-cell-token--word\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(column).toContain('inline-flex');
    expect(column).not.toContain('gap:');
    expect(column).not.toContain('margin:');
    expect(source).toMatch(/vertical-align:\s*1\.05em/);
    expect(source).not.toMatch(/\.js-cell-token-word\s*\{[^}]*padding-bottom/);
    expect(source).not.toMatch(/::after\s*\{[^}]*margin-top/);
  });

  it('renders host IPA and gloss as ruby-text lanes scaled by --cell-token-annotation-scale', () => {
    const source = buildTokenSpanCss();
    const cap = source.match(/reading-off\) > \.js-cell-token-ruby::after\s*\{([^}]*)\}/)?.[1] ?? '';
    const gloss = source.match(/gloss-off\)::after\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const lane of [cap, gloss]) {
      expect(lane).toContain('display: ruby-text');
      expect(lane).toContain('font-size: calc(var(--cell-token-annotation-scale) * 1em)');
      expect(lane).toContain('pointer-events: none');
      expect(lane).toContain('user-select: none');
    }
    expect(cap).toContain('content: attr(data-reading)');
    expect(cap).toContain('padding: var(--space-1) .35em var(--space-0-5)');
    expect(gloss).toContain('content: attr(data-gloss)');
    expect(gloss).toContain('padding: var(--space-1-5) .35em var(--space-2)');
  });

  it('sizes shadow reading and gloss lanes at 0.62em', () => {
    const source = buildTokenSpanCssForShadow();
    const cap = source.match(/reading-off\)::before\s*\{([^}]*)\}/)?.[1] ?? '';
    const gloss = source.match(/gloss-off\)::after\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(cap).toContain('font-size: 0.62em');
    expect(gloss).toContain('font-size: 0.62em');
  });

  it.each(['host', 'shadow'])('annotation lanes inherit the word style (color/italic/weight) in %s CSS', (variant) => {
    const source = variant === 'host' ? buildTokenSpanCss() : buildTokenSpanCssForShadow();
    const lanes =
      variant === 'host'
        ? [/(reading-off\) > \.js-cell-token-ruby::after\s*\{([^}]*)\})/, /(gloss-off\)::after\s*\{([^}]*)\})/]
        : [/(reading-off\)::before\s*\{([^}]*)\})/, /(gloss-off\)::after\s*\{([^}]*)\})/];
    for (const lane of lanes) {
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

  it('keeps a line box in the empty shadow cap lane so missing readings never lift the word', () => {
    const cap = buildTokenSpanCssForShadow().match(/reading-off\)::before\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(cap).toContain("content: attr(data-reading) '\\200B'");
    expect(cap).toContain('min-height:');
  });
});
