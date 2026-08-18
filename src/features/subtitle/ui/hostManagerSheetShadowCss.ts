/**
 * Canonical CSS manifest for the host-page manager sheet in shadow DOM.
 *
 * The host content script injects these strings into the shadow root created
 * on `document.body` when a cross-origin child iframe requests the manager
 * sheet (mobile scenario). Single source of truth — mirrors the `managerShadowCss`
 * array in `mountSubtitle.tsx` plus `HostManagerSheet.module.css`.
 */
import hostManagerSheetCss from './HostManagerSheet.module.css?inline';
import subtitleManagerCss from './SubtitleManagerPanel.module.css?inline';
import subtitleSearchCss from './SubtitleSearchPanel.module.css?inline';
import apiKeyManagerCss from '@/features/settings/ui/ApiKeyManager.module.css?inline';
import subtitleOffsetCss from './SubtitleOffsetPanel.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import footerBarCss from '@/shared/ui/FooterBar.module.css?inline';
import inputCss from '@/shared/ui/Input.module.css?inline';
import selectCss from '@/shared/ui/Select.module.css?inline';
import skeletonCss from '@/shared/ui/Skeleton.module.css?inline';
import tabsCss from '@/shared/ui/Tabs.module.css?inline';
import subtitlePanelsCss from './SubtitlePanels.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';
import { buildTokenSpanCssForShadow } from '@/features/tokenize/ui/tokenSpanCss';
import { appearanceShadowCss } from './appearance/appearanceShadowCss';

export const hostManagerSheetShadowCss: string[] = [
  hostManagerSheetCss,
  subtitleManagerCss,
  subtitleSearchCss,
  apiKeyManagerCss,
  subtitleOffsetCss,
  buttonCss,
  footerBarCss,
  inputCss,
  selectCss,
  skeletonCss,
  tabsCss,
  subtitlePanelsCss,
  iconCss,
  iconButtonCss,
  buildTokenSpanCssForShadow(),
  ...appearanceShadowCss,
];
