/**
 * Canonical CSS manifest for subtitle appearance components in shadow DOM.
 *
 * Both `mountSubtitle.tsx` (Manager panel) and `mountSettingsDialog.ts`
 * import this list to inject all appearance-related CSS into their respective
 * shadow roots. Single source of truth — add new appearance CSS here.
 */
import subtitleStylePanelCss from './SubtitleStylePanel.module.css?inline';
import subtitlePreviewCss from './SubtitlePreview.module.css?inline';
import overlayPreviewCss from './OverlayPreview.module.css?inline';
import subtitleBlockCss from '../SubtitleBlock.module.css?inline';
import subtitleBlockSettingsCss from './SubtitleBlockSettingsPanel.module.css?inline';
import navClusterSettingsCss from './NavClusterSettingsPanel.module.css?inline';
import navClusterCss from '../NavCluster.module.css?inline';
import sliderCss from '@/shared/ui/Slider.module.css?inline';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';
import toggleCss from '@/shared/ui/Toggle.module.css?inline';
import tabsCss from '@/shared/ui/Tabs.module.css?inline';
import subtitleManagerPanelCss from '../SubtitleManagerPanel.module.css?inline';

export const appearanceShadowCss: string[] = [
  subtitleStylePanelCss,
  subtitlePreviewCss,
  overlayPreviewCss,
  subtitleBlockCss,
  subtitleBlockSettingsCss,
  navClusterSettingsCss,
  navClusterCss,
  sliderCss,
  buttonCss,
  iconButtonCss,
  iconCss,
  toggleCss,
  tabsCss,
  subtitleManagerPanelCss,
];
