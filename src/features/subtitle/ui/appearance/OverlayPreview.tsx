import type { CSSProperties } from 'react';
import type { SrtCue, SubtitleBlockSettings, NavClusterSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { SubtitleBlock } from '../SubtitleBlock';
import { NavCluster } from '../NavCluster';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { buildClusterCssVars } from '../subtitleUI';
import { t } from '@/shared/i18n';
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
    <div className={styles.frame} data-tihoka-id="overlay-preview">
      <div className={styles.overlayRoot} style={rootStyle} data-tihoka-id="overlay-preview-root">
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

        <div className={styles.clusterRight} style={toolbarStyle} data-tihoka-id="overlay-preview-toolbar">
          <div className={styles.primaryCol}>
            <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.quickAdd')} size="sm" onClick={noop}>
              <Icon name="zap"  />
            </Button>
            <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.editCard')} size="sm" onClick={noop}>
              <Icon name="pencil"  />
            </Button>
            <div className={styles.toggleWrap}>
              <div className={styles.extraCol}>
                <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.openList')} size="sm" onClick={noop}>
                  <Icon name="sidePanel"  />
                </Button>
                <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.generateNative')} size="sm" onClick={noop}>
                  <Icon name="languages"  />
                </Button>
              </div>
              <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.expandTools')} size="sm" onClick={noop}>
                <Icon name="chevronLeft"  />
              </Button>
            </div>
          </div>
          <div className={styles.secondaryCol}>
            <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.updateCard')} size="sm" onClick={noop}>
              <Icon name="rotateCcw"  />
            </Button>
            <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.openManager')} size="sm" onClick={noop}>
              <Icon name="subtitleManager"  />
            </Button>
            <Button shape="circle" variant="overlay" aria-label={t('subtitle.toolbar.enterPlayerMode')} size="sm" onClick={noop}>
              <Icon name="maximize"  />
            </Button>
          </div>
        </div>
      </div>
      <span className={styles.hint}>{t('subtitle.preview.clickToEdit')}</span>
    </div>
  );
}
