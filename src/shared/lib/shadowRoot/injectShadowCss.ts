import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';
import scrollbarsShadowCss from '@/shared/styles/scrollbars-shadow.css?raw';
import { installRippleDelegation } from '@/shared/lib/dom/ripple';

export interface InjectShadowCssOptions {
  /** Per-component CSS strings (e.g. `Button.module.css?inline`) appended after globals. */
  css?: string[];
}

const SHADOW_STYLE_MARKER = 'data-cell-shadow-css';

const BASE_SHADOW_CSS = `${tokensCss.replace(/:root\b/g, ':host')}\n${componentsCss}\n${scrollbarsShadowCss}`;

const sheetCache = new Map<string, CSSStyleSheet>();
const adoptedByRoot = new WeakMap<ShadowRoot, readonly CSSStyleSheet[]>();

function canAdoptSheets(shadow: ShadowRoot): boolean {
  return 'adoptedStyleSheets' in shadow
    && typeof CSSStyleSheet === 'function'
    && typeof CSSStyleSheet.prototype.replaceSync === 'function';
}

function cachedSheet(cssText: string): CSSStyleSheet {
  let sheet = sheetCache.get(cssText);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    sheetCache.set(cssText, sheet);
  }
  return sheet;
}

/**
 * Inject the design-token layer, legacy utility layer, and any per-component
 * CSS into a shadow root.
 *
 * `tokens.css` uses `:root` for static tokens and `[data-theme]` for color +
 * component tokens. In a shadow root we rewrite `:root` to `:host` so static
 * tokens apply to the shadow host. `[data-theme]` selectors are left unchanged
 * so they match the inner container (set by `ShadowThemeProvider`) and
 * component tokens resolve against the active palette.
 *
 * Sheets are shared via `adoptedStyleSheets` when supported — one parsed
 * `CSSStyleSheet` per unique css text is reused across every shadow root,
 * so repeat mounts (toasts, pills) skip the per-mount string join + parse.
 * Otherwise falls back to a `<style>` element.
 *
 * Returns a cleanup function that removes the injected styles.
 */
export function injectShadowCss(
  shadow: ShadowRoot,
  options: InjectShadowCssOptions = {},
): () => void {
  const { css = [] } = options;
  const existing = shadow.querySelector(`style[${SHADOW_STYLE_MARKER}]`) as HTMLStyleElement | null;
  const cleanupRipple = installRippleDelegation(shadow);

  if (!existing && canAdoptSheets(shadow)) {
    const sheets: CSSStyleSheet[] = [cachedSheet(BASE_SHADOW_CSS)];
    if (css.length > 0) sheets.push(cachedSheet(css.join('\n')));
    const previous = adoptedByRoot.get(shadow) ?? [];
    shadow.adoptedStyleSheets = [
      ...shadow.adoptedStyleSheets.filter((s) => !previous.includes(s)),
      ...sheets,
    ];
    adoptedByRoot.set(shadow, sheets);
    return () => {
      cleanupRipple();
      shadow.adoptedStyleSheets = shadow.adoptedStyleSheets.filter((s) => !sheets.includes(s));
      adoptedByRoot.delete(shadow);
    };
  }

  const style = existing ?? document.createElement('style');
  style.setAttribute(SHADOW_STYLE_MARKER, '');
  style.textContent = css.length > 0
    ? `${BASE_SHADOW_CSS}\n${css.join('\n')}`
    : BASE_SHADOW_CSS;

  if (!existing) {
    shadow.appendChild(style);
  }

  return () => {
    cleanupRipple();
    style.remove();
  };
}
