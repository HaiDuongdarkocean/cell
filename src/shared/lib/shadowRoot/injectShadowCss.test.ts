import { injectShadowCss } from './injectShadowCss';

function freshShadow(): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

describe('injectShadowCss', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('falls back to a <style> element when adoptedStyleSheets is unavailable', () => {
    const shadow = freshShadow();
    const cleanup = injectShadowCss(shadow, { css: ['.x { color: red; }'] });

    const style = shadow.querySelector('style[data-cell-shadow-css]');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('.x { color: red; }');

    cleanup();
    expect(shadow.querySelector('style[data-cell-shadow-css]')).toBeNull();
  });

  it('reuses the existing marked <style> on re-inject', () => {
    const shadow = freshShadow();
    injectShadowCss(shadow, { css: ['.a {}'] });
    injectShadowCss(shadow, { css: ['.b {}'] });

    const styles = shadow.querySelectorAll('style[data-cell-shadow-css]');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toContain('.b {}');
    expect(styles[0]!.textContent).not.toContain('.a {}');
  });

  describe('with adoptedStyleSheets support', () => {
    const realSheet = globalThis.CSSStyleSheet;
    let replaceSync: jest.Mock<(text: string) => void>;

    class FakeSheet {
      cssText = '';
      replaceSync(text: string): void {
        this.cssText = text;
        replaceSync(text);
      }
    }

    const adopted = new WeakMap<ShadowRoot, CSSStyleSheet[]>();

    beforeEach(() => {
      replaceSync = jest.fn();
      Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
        configurable: true,
        get(this: ShadowRoot) {
          return adopted.get(this) ?? [];
        },
        set(this: ShadowRoot, sheets: CSSStyleSheet[]) {
          adopted.set(this, sheets);
        },
      });
      Object.defineProperty(globalThis, 'CSSStyleSheet', {
        configurable: true,
        writable: true,
        value: FakeSheet,
      });
    });

    afterEach(() => {
      delete (ShadowRoot.prototype as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
      Object.defineProperty(globalThis, 'CSSStyleSheet', {
        configurable: true,
        writable: true,
        value: realSheet,
      });
    });

    it('adopts cached sheets instead of appending <style>', () => {
      const shadow = freshShadow();
      const cleanup = injectShadowCss(shadow, { css: ['.y { color: blue; }'] });

      expect(shadow.querySelector('style')).toBeNull();
      expect(shadow.adoptedStyleSheets).toHaveLength(2);

      cleanup();
      expect(shadow.adoptedStyleSheets).toHaveLength(0);
    });

    it('shares parsed sheets across shadow roots with identical css', () => {
      const first = freshShadow();
      const second = freshShadow();
      injectShadowCss(first, { css: ['.shared {}'] });
      const calls = replaceSync.mock.calls.length;
      injectShadowCss(second, { css: ['.shared {}'] });

      expect(replaceSync.mock.calls.length).toBe(calls);
      expect(second.adoptedStyleSheets).toEqual(first.adoptedStyleSheets);
    });

    it('replaces previously adopted sheets on re-inject', () => {
      const shadow = freshShadow();
      injectShadowCss(shadow, { css: ['.one {}'] });
      injectShadowCss(shadow, { css: ['.two {}', '.three {}'] });

      expect(shadow.adoptedStyleSheets).toHaveLength(2);
      expect(
        (shadow.adoptedStyleSheets[1] as unknown as FakeSheet).cssText,
      ).toContain('.two {}');
    });
  });
});
