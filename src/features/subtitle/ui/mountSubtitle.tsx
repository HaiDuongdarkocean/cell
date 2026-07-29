import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import type { OverlayStyleConfig } from '@/entities/subtitle';

import { SubtitlePanels, type SubtitlePanelsRef } from './SubtitlePanels';
import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?inline';
import subtitleBlockCss from './SubtitleBlock.module.css?inline';
import navClusterCss from './NavCluster.module.css?inline';
import subtitleManagerCss from './SubtitleManagerPanel.module.css?inline';
import subtitleOffsetCss from './SubtitleOffsetPanel.module.css?inline';
import subtitleToastCss from './SubtitleToast.module.css?inline';
import subtitleHintCss from './SubtitleHint.module.css?inline';
import subtitlePanelsCss from './SubtitlePanels.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';

export type { SubtitlePanelsRef } from './SubtitlePanels';

export interface MountSubtitleOptions {
  container: HTMLElement;
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;

  collapsed: boolean;
  hasSubtitle: boolean;
  isPlaying: boolean;
  repeatActive: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onToggleCollapsed: () => void;
}

export interface MountSubtitleResult {
  unmount: () => void;
  setManagerOpen: (open: boolean) => void;
  setOffsetOpen: (open: boolean) => void;
  setHintOpen: (open: boolean) => void;
  addToast: (message: string, variant?: 'success' | 'error' | 'warning' | 'info') => void;
  clearToasts: () => void;
}

export function mountSubtitle(options: MountSubtitleOptions): MountSubtitleResult {
  const {
    container,
    targetStyle,
    nativeStyle,
    collapsed,
    hasSubtitle,
    isPlaying,
    repeatActive,
    onPrev,
    onNext,
    onRepeat,
    onRewind,
    onForward,
    onPlayPause,
    onToggleCollapsed,
  } = options;

  let controllerRef: SubtitlePanelsRef | null = null;

  const { unmount } = mountReactShadow(
    <SubtitlePanels
      ref={(r) => { controllerRef = r; }}
      targetStyle={targetStyle}
      nativeStyle={nativeStyle}
      collapsed={collapsed}
      hasSubtitle={hasSubtitle}
      isPlaying={isPlaying}
      repeatActive={repeatActive}
      onPrev={onPrev}
      onNext={onNext}
      onRepeat={onRepeat}
      onRewind={onRewind}
      onForward={onForward}
      onPlayPause={onPlayPause}
      onToggleCollapsed={onToggleCollapsed}
    />,
    {
      parent: container,
      layer: 2,
      position: 'absolute',
      css: [
        tokensCss,
        componentsCss,
        subtitleBlockCss,
        navClusterCss,
        subtitleManagerCss,
        subtitleOffsetCss,
        subtitleToastCss,
        subtitleHintCss,
        subtitlePanelsCss,
        iconCss,
        iconButtonCss,
      ],
    },
  );

  return {
    unmount,
    setManagerOpen: (open) => controllerRef?.setManagerOpen(open),
    setOffsetOpen: (open) => controllerRef?.setOffsetOpen(open),
    setHintOpen: (open) => controllerRef?.setHintOpen(open),
    addToast: (message, variant) => controllerRef?.addToast(message, variant),
    clearToasts: () => controllerRef?.clearToasts(),
  };
}
