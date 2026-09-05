/**
 * CSS manifest for the host-page manager sheet in shadow DOM.
 *
 * The host content script injects these strings into the shadow root created
 * on `document.body` when a cross-origin child iframe requests the manager
 * sheet (mobile scenario). `allModuleCss` auto-collects every CSS module;
 * only the dynamic token-span CSS is appended manually.
 */
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { buildTokenSpanCssForShadow } from '@/features/tokenize/ui/tokenSpanCss';

export const hostManagerSheetShadowCss: string[] = [
  ...allModuleCss,
  buildTokenSpanCssForShadow(),
];
