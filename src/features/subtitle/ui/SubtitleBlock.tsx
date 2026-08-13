import { memo } from 'react';
import type { SrtCue } from '@/entities/media/types';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings } from '@/entities/media';
import { useCuesStore } from '@/stores/cuesStore';
import { buildTextShadow, hexToRgba, sanitizeFontFamily } from './subtitleUI';
import styles from './SubtitleBlock.module.css';

interface SubtitleBlockCues {
  targetCues: SrtCue[];
  nativeCues: SrtCue[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
}

interface SubtitleBlockProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  cues?: SubtitleBlockCues;
  blockSettings?: SubtitleBlockSettings;
  /** Optional appearance-preview editing; production overlay leaves this disabled. */
  editable?: boolean;
  onTextChange?: (role: 'target' | 'native', text: string) => void;
}

const selectTargetCues = (state: { targetCues: SrtCue[] }): SrtCue[] => state.targetCues;
const selectNativeCues = (state: { nativeCues: SrtCue[] }): SrtCue[] => state.nativeCues;
const selectTargetActiveIndex = (state: { targetActiveIndex: number }): number => state.targetActiveIndex;
const selectNativeActiveIndex = (state: { nativeActiveIndex: number }): number => state.nativeActiveIndex;

function buildLayerStyle(config: OverlayStyleConfig): React.CSSProperties {
  const fs = config.fontSize;
  return {
    display: config.visible ? 'block' : 'none',
    // Auto-scale font: 50%→100% of configured size based on container width (cqw)
    fontSize: `clamp(${Math.round(fs * 0.5)}px, ${Math.round(fs * 0.1)}cqw, ${fs}px)`,
    color: config.textColor,
    backgroundColor: hexToRgba(config.backgroundColor, config.backgroundOpacity),
    opacity: config.textOpacity,
    textShadow: buildTextShadow(config.textShadow),
    fontFamily: sanitizeFontFamily(config.fontFamily),
    fontWeight: config.fontWeight,
    textAlign: config.horizontalAlign,
  };
}

function SubtitleBlockInner({
  targetStyle,
  nativeStyle,
  cues,
  blockSettings,
  editable = false,
  onTextChange,
}: SubtitleBlockProps): React.JSX.Element | null {
  const storeTargetCues = useCuesStore(selectTargetCues);
  const storeNativeCues = useCuesStore(selectNativeCues);
  const storeTargetActiveIndex = useCuesStore(selectTargetActiveIndex);
  const storeNativeActiveIndex = useCuesStore(selectNativeActiveIndex);

  const targetCues = cues?.targetCues ?? storeTargetCues;
  const nativeCues = cues?.nativeCues ?? storeNativeCues;
  const targetActiveIndex = cues?.targetActiveIndex ?? storeTargetActiveIndex;
  const nativeActiveIndex = cues?.nativeActiveIndex ?? storeNativeActiveIndex;

  const targetCue = targetCues[targetActiveIndex];
  const nativeCue = nativeCues[nativeActiveIndex];

  // Apply block settings (globalScale, bgOpacity) from extension popup
  const globalScale = blockSettings?.globalScale ?? 1;
  const blockBgOpacity = blockSettings?.bgOpacity ?? 0.7;
  const blockStyle: React.CSSProperties = {
    transform: `scale(${globalScale})`,
    transformOrigin: 'center',
  };

  // ADR-025: block container luôn render để giữ 3-zone layout shape khi cues rỗng.
  // Layer background chỉ hiện khi có cue → không có subtitle = không có background.
  const hasTargetCue = targetStyle.visible && targetCue;
  const hasNativeCue = nativeStyle.visible && nativeCue;
  const handleTextBlur = (role: 'target' | 'native', event: React.FocusEvent<HTMLSpanElement>): void => {
    onTextChange?.(role, event.currentTarget.textContent ?? '');
  };

  return (
    <div className={styles.block} style={blockStyle} data-cell-id="subtitle-block">
      <div className={styles.layer} data-role="target" style={{ ...buildLayerStyle(targetStyle), backgroundColor: hasTargetCue ? hexToRgba(targetStyle.backgroundColor, targetStyle.backgroundOpacity * blockBgOpacity) : 'transparent' }}>
        <span
          className={styles.text}
          data-cell-id={editable ? 'overlay-preview-target-line' : undefined}
          contentEditable={editable}
          suppressContentEditableWarning={editable}
          onBlur={editable ? (event) => handleTextBlur('target', event) : undefined}
        >
          {targetCue?.text ?? ''}
        </span>
      </div>
      {hasNativeCue && (
        <div className={styles.layer} data-role="native" style={{ ...buildLayerStyle(nativeStyle), backgroundColor: hexToRgba(nativeStyle.backgroundColor, nativeStyle.backgroundOpacity * blockBgOpacity) }}>
          <span
            className={styles.text}
            data-cell-id={editable ? 'overlay-preview-native-line' : undefined}
            contentEditable={editable}
            suppressContentEditableWarning={editable}
            onBlur={editable ? (event) => handleTextBlur('native', event) : undefined}
          >
            {nativeCue.text}
          </span>
        </div>
      )}
    </div>
  );
}

export const SubtitleBlock = memo(SubtitleBlockInner);
