import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings } from '@/entities/media';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?inline';
import subtitleBlockCss from './SubtitleBlock.module.css?inline';
import navClusterCss from './NavCluster.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';

export interface MountSubtitleOptions {
  container: HTMLElement;
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  clusterSettings: NavClusterSettings;
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

export function mountSubtitle(options: MountSubtitleOptions): { unmount: () => void } {
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

  const { unmount } = mountReactShadow(
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: '10%',
      }}
    >
      <SubtitleBlock targetStyle={targetStyle} nativeStyle={nativeStyle} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}>
        <NavCluster
          collapsed={collapsed}
          hasSubtitle={hasSubtitle}
          isPlaying={isPlaying}
          repeatActive={repeatActive}
          onToggleCollapsed={onToggleCollapsed}
          onPrev={onPrev}
          onNext={onNext}
          onRepeat={onRepeat}
          onRewind={onRewind}
          onForward={onForward}
          onPlayPause={onPlayPause}
        />
      </div>
    </div>,
    {
      parent: container,
      layer: 2,
      position: 'absolute',
      css: [tokensCss, componentsCss, subtitleBlockCss, navClusterCss, iconCss, iconButtonCss],
    },
  );

  return { unmount };
}
