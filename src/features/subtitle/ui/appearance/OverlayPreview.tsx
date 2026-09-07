import type { CSSProperties } from 'react';
import type { SrtCue, SubtitleBlockSettings, NavClusterSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { SubtitleBlock } from '../SubtitleBlock';
import { NavCluster } from '../NavCluster';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { buildClusterCssVars } from '../subtitleUI';
import styles from './OverlayPreview.module.css';

interface OverlayPreviewProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  blockSettings: SubtitleBlockSettings;
  clusterSettings: NavClusterSettings;
  targetText: string;
  nativeText: string;
  onTextChange: (role: 'target' | 'native', text: string) => void;
}

function createPreviewCue(text: string): SrtCue {
  return { index: 0, start: 0, end: 1, text };
}

const noop = (): void => undefined;

export function OverlayPreview({
  targetStyle,
  nativeStyle,
  blockSettings,
  clusterSettings,
  targetText,
  nativeText,
  onTextChange,
}: OverlayPreviewProps): React.JSX.Element {
  const yOffsetPercent = blockSettings.yOffsetPercent ?? 75;

  const previewCues = {
    targetCues: [createPreviewCue(targetText)],
    nativeCues: [createPreviewCue(nativeText)],
    targetActiveIndex: 0,
    nativeActiveIndex: 0,
  };

  const rootStyle: CSSProperties = {
    '--sb-y': yOffsetPercent,
  } as CSSProperties;

  const toolbarStyle = buildClusterCssVars(clusterSettings);

  return (
    <div className={styles.frame} data-cell-id="overlay-preview">
      <div className={styles.overlayRoot} style={rootStyle} data-cell-id="overlay-preview-root">
        <div className={styles.navLayer}>
          <NavCluster
            collapsed={false}
            isPlaying={false}
            clusterSettings={clusterSettings}
            onToggleCollapsed={noop}
            onPrev={noop}
            onNext={noop}
            onRepeat={noop}
            onRewind={noop}
            onForward={noop}
            onPlayPause={noop}
          />
        </div>

        <div className={styles.blockLayer}>
          <SubtitleBlock
            targetStyle={targetStyle}
            nativeStyle={nativeStyle}
            cues={previewCues}
            blockSettings={blockSettings}
            editable
            onTextChange={onTextChange}
          />
        </div>

        <div className={styles.clusterRight} style={toolbarStyle} data-cell-id="overlay-preview-toolbar">
          <div className={styles.primaryCol}>
            <Button shape="circle" variant="secondary" aria-label="Quick add card" size="sm" onClick={noop}>
              <Icon name="zap"  />
            </Button>
            <Button shape="circle" variant="secondary" aria-label="Edit card" size="sm" onClick={noop}>
              <Icon name="pencil"  />
            </Button>
            <div className={styles.toggleWrap}>
              <div className={styles.extraCol}>
                <Button shape="circle" variant="secondary" aria-label="Open subtitle list" size="sm" onClick={noop}>
                  <Icon name="sidePanel"  />
                </Button>
                <Button shape="circle" variant="secondary" aria-label="Generate native subtitle" size="sm" onClick={noop}>
                  <Icon name="languages"  />
                </Button>
              </div>
              <Button shape="circle" variant="secondary" aria-label="Expand tools" size="sm" onClick={noop}>
                <Icon name="chevronLeft"  />
              </Button>
            </div>
          </div>
          <div className={styles.secondaryCol}>
            <Button shape="circle" variant="secondary" aria-label="Update current card" size="sm" onClick={noop}>
              <Icon name="rotateCcw"  />
            </Button>
            <Button shape="circle" variant="secondary" aria-label="Open subtitle manager" size="sm" onClick={noop}>
              <Icon name="subtitleManager"  />
            </Button>
            <Button shape="circle" variant="secondary" aria-label="Enter player mode" size="sm" onClick={noop}>
              <Icon name="maximize"  />
            </Button>
          </div>
        </div>
      </div>
      <span className={styles.hint}>Click text to edit</span>
    </div>
  );
}
