import { memo } from 'react';
import type { SrtCue } from '@/entities/media/types';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { useCuesStore } from '@/stores/cuesStore';
import { buildTextShadow, hexToRgba, sanitizeFontFamily } from './subtitleUI';
import styles from './SubtitleBlock.module.css';

interface SubtitleBlockProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
}

const selectTargetCues = (state: { targetCues: SrtCue[] }): SrtCue[] => state.targetCues;
const selectNativeCues = (state: { nativeCues: SrtCue[] }): SrtCue[] => state.nativeCues;
const selectTargetActiveIndex = (state: { targetActiveIndex: number }): number => state.targetActiveIndex;
const selectNativeActiveIndex = (state: { nativeActiveIndex: number }): number => state.nativeActiveIndex;

function buildLayerStyle(config: OverlayStyleConfig): React.CSSProperties {
  return {
    display: config.visible ? 'block' : 'none',
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
  const targetCues = useCuesStore(selectTargetCues);
  const nativeCues = useCuesStore(selectNativeCues);
  const targetActiveIndex = useCuesStore(selectTargetActiveIndex);
  const nativeActiveIndex = useCuesStore(selectNativeActiveIndex);

  const targetCue = targetCues[targetActiveIndex];
  const nativeCue = nativeCues[nativeActiveIndex];

  if (!targetCue && !nativeCue) return null;

  return (
    <div className={styles.block} data-testid="subtitle-block">
      <div className={styles.layer} data-role="target" style={buildLayerStyle(targetStyle)}>
        <span className={styles.text}>{targetStyle.visible ? targetCue?.text ?? '' : ''}</span>
      </div>
      {nativeStyle.visible && nativeCue && (
        <div className={styles.layer} data-role="native" style={buildLayerStyle(nativeStyle)}>
          <span className={styles.text}>{nativeCue.text}</span>
        </div>
      )}
    </div>
  );
}

export const SubtitleBlock = memo(SubtitleBlockInner);
