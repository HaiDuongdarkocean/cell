import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';

export interface InjectShadowCssOptions {
  /** Per-component CSS strings (e.g. `Button.module.css?inline`) appended after globals. */
  css?: string[];
}

const SHADOW_STYLE_MARKER = 'data-cell-shadow-css';

/**
 * Inject the design-token layer, legacy utility layer, and any per-component
 * CSS into a shadow root.
 *
 * `tokens.css` uses `:root` by default; in a shadow root we rewrite it to
 * `:host` so the variables apply to the shadow host instead of the document.
 *
 * The call is idempotent: multiple calls on the same shadow root only update
 * the single `<style>` element instead of appending duplicates.
 *
 * Returns a cleanup function that removes the `<style>` element.
 */
export function injectShadowCss(
  shadow: ShadowRoot,
  options: InjectShadowCssOptions = {},
): () => void {
  const { css = [] } = options;
  const existing = shadow.querySelector(`style[${SHADOW_STYLE_MARKER}]`) as HTMLStyleElement | null;

  const style = existing ?? document.createElement('style');
  style.setAttribute(SHADOW_STYLE_MARKER, '');
  style.textContent = `${tokensCss.replace(/:root\b/g, ':host')}\n${componentsCss}${
    css.length > 0 ? `\n${css.join('\n')}` : ''
  }`;

  if (!existing) {
    shadow.appendChild(style);
  }

  return () => style.remove();
}
