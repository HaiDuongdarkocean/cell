import { memo } from 'react';
import type { BilingualCue } from '@/entities/media/types';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { useCuesStore } from '@/stores/cuesStore';
import { buildTextShadow, hexToRgba, sanitizeFontFamily } from './subtitleUI';
import styles from './SubtitleBlock.module.css';

interface SubtitleBlockProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
}

const selectCues = (state: { cues: BilingualCue[] }): BilingualCue[] => state.cues;
const selectActiveIndex = (state: { activeIndex: number }): number => state.activeIndex;

function buildLayerStyle(config: OverlayStyleConfig): React.CSSProperties {
  return {
    display: config.visible ? 'flex' : 'none',
    fontSize: `${config.fontSize}px`,
    color: config.textColor,
    backgroundColor: hexToRgba(config.backgroundColor, config.backgroundOpacity),
    opacity: config.textOpacity,
    textShadow: buildTextShadow(config.textShadow),
    fontFamily: sanitizeFontFamily(config.fontFamily),
    fontWeight: config.fontWeight,
    textAlign: config.horizontalAlign,
  };
}

function SubtitleBlockInner({ targetStyle, nativeStyle }: SubtitleBlockProps): React.JSX.Element | null {
  const cues = useCuesStore(selectCues);
  const activeIndex = useCuesStore(selectActiveIndex);
  const cue = cues[activeIndex];

  if (!cue) return null;

  return (
    <div className={styles.block} data-testid="subtitle-block">
      <div className={styles.layer} data-role="target" style={buildLayerStyle(targetStyle)}>
        <span className={styles.text}>{cue.targetText}</span>
      </div>
      {nativeStyle.visible && cue.nativeText && (
        <div className={styles.layer} data-role="native" style={buildLayerStyle(nativeStyle)}>
          <span className={styles.text}>{cue.nativeText}</span>
        </div>
      )}
    </div>
  );
}

export const SubtitleBlock = memo(SubtitleBlockInner);
