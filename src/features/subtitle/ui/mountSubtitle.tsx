import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';

import { SubtitlePanels, type SubtitlePanelsRef, type ManagerState, type OffsetState } from './SubtitlePanels';
import type { ToastVariant } from './SubtitleToast';
import subtitleBlockCss from './SubtitleBlock.module.css?inline';
import navClusterCss from './NavCluster.module.css?inline';
import subtitleManagerCss from './SubtitleManagerPanel.module.css?inline';
import subtitleOffsetCss from './SubtitleOffsetPanel.module.css?inline';
import subtitleToastCss from './SubtitleToast.module.css?inline';
import subtitleHintCss from './SubtitleHint.module.css?inline';
import subtitlePanelsCss from './SubtitlePanels.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';
import { ICON_CATALOG } from '@/shared/icons';

export type { SubtitlePanelsRef, ManagerState, OffsetState } from './SubtitlePanels';

type IconCatalogKey = keyof typeof ICON_CATALOG;

export interface MountSubtitleOptions {
  container: HTMLElement;
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;

  collapsed: boolean;
  hasSubtitle: boolean;
  isPlaying: boolean;
  repeatActive: boolean;
  repeatIcon?: IconCatalogKey;
  repeatLabel?: string;
  yOffsetPercent?: number;
  onDragReposition?: (yOffsetPercent: number) => void;
  manager?: ManagerState;
  offset?: OffsetState;
  generateNativeEnabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onToggleCollapsed: () => void;
  onQuickAdd?: () => void;
  onEditCard?: () => void;
  onUpdateCurrentCard?: () => void;
  onGenerateNative?: () => void;
  onToggleSidePanel?: () => void;
  onToggleManager?: () => void;
}

export interface MountSubtitleResult {
  unmount: () => void;
  setStyles: (targetStyle: OverlayStyleConfig, nativeStyle: OverlayStyleConfig) => void;
  setHasSubtitle: (has: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setRepeatActive: (active: boolean) => void;
  setRepeatIcon: (icon: IconCatalogKey, label?: string) => void;
  setManager: (manager: ManagerState) => void;
  setOffset: (offset: OffsetState) => void;
  setManagerOpen: (open: boolean) => void;
  setOffsetOpen: (open: boolean) => void;
  setHintOpen: (open: boolean) => void;
  setGenerateNativeEnabled: (enabled: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  setYOffsetPercent: (yOffsetPercent: number) => void;
  setClusterSettings: (settings: NavClusterSettings) => void;
  setBlockSettings: (settings: SubtitleBlockSettings) => void;
  addToast: (message: string, variant?: ToastVariant) => void;
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
    repeatIcon,
    repeatLabel,
    yOffsetPercent,
    onDragReposition,
    manager,
    offset,
    generateNativeEnabled,
    onPrev,
    onNext,
    onRepeat,
    onRewind,
    onForward,
    onPlayPause,
    onToggleCollapsed,
    onQuickAdd,
    onEditCard,
    onUpdateCurrentCard,
    onGenerateNative,
    onToggleSidePanel,
    onToggleManager,
  } = options;

  let controllerRef: SubtitlePanelsRef | null = null;

  const { unmount, host } = mountReactShadow(
    <SubtitlePanels
      ref={(r) => { controllerRef = r; }}
      targetStyle={targetStyle}
      nativeStyle={nativeStyle}
      collapsed={collapsed}
      hasSubtitle={hasSubtitle}
      isPlaying={isPlaying}
      repeatActive={repeatActive}
      repeatIcon={repeatIcon}
      repeatLabel={repeatLabel}
      yOffsetPercent={yOffsetPercent ?? 75}
      onDragReposition={onDragReposition}
      manager={manager}
      offset={offset}
      generateNativeEnabled={generateNativeEnabled}
      onPrev={onPrev}
      onNext={onNext}
      onRepeat={onRepeat}
      onRewind={onRewind}
      onForward={onForward}
      onPlayPause={onPlayPause}
      onToggleCollapsed={onToggleCollapsed}
      onQuickAdd={onQuickAdd}
      onEditCard={onEditCard}
      onUpdateCurrentCard={onUpdateCurrentCard}
      onGenerateNative={onGenerateNative}
      onToggleSidePanel={onToggleSidePanel}
      onToggleManager={onToggleManager}
    />,
    {
      parent: container,
      layer: 2,
      position: 'absolute',
      reparentOnFullscreen: true,
      css: [
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

  // Host fills the video container but lets clicks pass through to player controls.
  // pointer-events:none on host → player controls stay interactive.
  // .root (panelsRoot) sets pointer-events:auto on its interactive children.
  host.id = 'cell-subtitle-root';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';

  return {
    unmount,
    setStyles: (t, n) => controllerRef?.setStyles(t, n),
    setHasSubtitle: (has) => controllerRef?.setHasSubtitle(has),
    setIsPlaying: (playing) => controllerRef?.setIsPlaying(playing),
    setRepeatActive: (active) => controllerRef?.setRepeatActive(active),
    setRepeatIcon: (icon, label) => controllerRef?.setRepeatIcon(icon, label),
    setManager: (m) => controllerRef?.setManager(m),
    setOffset: (o) => controllerRef?.setOffset(o),
    setManagerOpen: (open) => controllerRef?.setManagerOpen(open),
    setOffsetOpen: (open) => controllerRef?.setOffsetOpen(open),
    setHintOpen: (open) => controllerRef?.setHintOpen(open),
    setGenerateNativeEnabled: (enabled) => controllerRef?.setGenerateNativeEnabled(enabled),
    setCollapsed: (collapsed) => controllerRef?.setCollapsed(collapsed),
    setYOffsetPercent: (y) => controllerRef?.setYOffsetPercent(y),
    setClusterSettings: (s) => controllerRef?.setClusterSettings(s),
    setBlockSettings: (s) => controllerRef?.setBlockSettings(s),
    addToast: (message, variant) => controllerRef?.addToast(message, variant),
    clearToasts: () => controllerRef?.clearToasts(),
  };
}
