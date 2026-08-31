import { memo, useEffect } from 'react';
import type { SrtCue } from '@/entities/media/types';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings } from '@/entities/media';
import { useCuesStore, type LoadErrorType, type LoadStatus, type SubtitleSource } from '@/stores/cuesStore';
import { buildTextShadow, hexToRgba, sanitizeFontFamily } from './subtitleUI';
import { removeBracketedText } from '../logic/removeBracketed';
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
  /** Strip content inside parentheses, brackets, or braces when rendering. */
  removeBracketed?: boolean;
}

const selectTargetCues = (state: { targetCues: SrtCue[] }): SrtCue[] => state.targetCues;
const selectNativeCues = (state: { nativeCues: SrtCue[] }): SrtCue[] => state.nativeCues;
const selectTargetActiveIndex = (state: { targetActiveIndex: number }): number => state.targetActiveIndex;
const selectNativeActiveIndex = (state: { nativeActiveIndex: number }): number => state.nativeActiveIndex;
const selectTargetLoadStatus = (state: { targetLoadStatus: LoadStatus }): LoadStatus => state.targetLoadStatus;
const selectNativeLoadStatus = (state: { nativeLoadStatus: LoadStatus }): LoadStatus => state.nativeLoadStatus;

/** Suffix appended to "Loaded <lang>" based on the subtitle source. */
const SOURCE_SUFFIX: Record<SubtitleSource, string> = {
  imported: ' (imported)',
  search: ' (from search)',
  translated: ' (translated)',
  auto: '',
};

/** Suffix appended to error messages based on the error type. */
const ERROR_SUFFIX: Record<LoadErrorType, string> = {
  timeout: ' (timeout)',
  offline: ' (offline)',
  'not-found': ' (not found)',
  invalid: ' (invalid file)',
  empty: ' (empty file)',
  unknown: '',
};

/** Build a human-readable inline status message from a LoadStatus.
 *  Returns null when state is 'idle' (no status to show).
 *  'loaded' shows "Loaded English" — cleared automatically when an active
 *  cue appears (caller passes null when there IS an active cue). */
function buildStatusText(status: LoadStatus): string | null {
  const lang = status.languageLabel ?? '';
  switch (status.state) {
    case 'loading': return lang ? `Loading ${lang}…` : 'Loading subtitle…';
    case 'loaded': {
      if (!lang) return 'Subtitle loaded';
      const sourceSuffix = status.source ? SOURCE_SUFFIX[status.source] : '';
      const trackSuffix = status.trackIndex && status.trackIndex > 0 ? ` (track ${status.trackIndex})` : '';
      return `Loaded ${lang}${sourceSuffix}${trackSuffix}`;
    }
    case 'translating': {
      const target = lang || 'native';
      const progressSuffix = status.progress ? ` (${status.progress.current}/${status.progress.total})` : '';
      return `Translating to ${target}…${progressSuffix}`;
    }
    case 'error': {
      const errorSuffix = status.errorType ? ERROR_SUFFIX[status.errorType] : '';
      return lang ? `Couldn't load ${lang} subtitle${errorSuffix}` : `Couldn't load subtitle${errorSuffix}`;
    }
    case 'none': return 'No subtitles found on this page';
    case 'idle': return null;
  }
}

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
  removeBracketed = false,
}: SubtitleBlockProps): React.JSX.Element | null {
  const storeTargetCues = useCuesStore(selectTargetCues);
  const storeNativeCues = useCuesStore(selectNativeCues);
  const storeTargetActiveIndex = useCuesStore(selectTargetActiveIndex);
  const storeNativeActiveIndex = useCuesStore(selectNativeActiveIndex);
  const storeTargetLoadStatus = useCuesStore(selectTargetLoadStatus);
  const storeNativeLoadStatus = useCuesStore(selectNativeLoadStatus);

  const targetCues = cues?.targetCues ?? storeTargetCues;
  const nativeCues = cues?.nativeCues ?? storeNativeCues;
  const targetActiveIndex = cues?.targetActiveIndex ?? storeTargetActiveIndex;
  const nativeActiveIndex = cues?.nativeActiveIndex ?? storeNativeActiveIndex;

  const targetCue = targetCues[targetActiveIndex];
  const nativeCue = nativeCues[nativeActiveIndex];

  const targetText = targetCue
    ? (removeBracketed ? removeBracketedText(targetCue.text) : targetCue.text)
    : null;
  const nativeText = nativeCue
    ? (removeBracketed ? removeBracketedText(nativeCue.text) : nativeCue.text)
    : null;

  // Inline load status — shown only when no active cue. When cues arrive,
  // setCues clears the status → subtitle text takes over.
  const targetStatusText = !targetCue ? buildStatusText(storeTargetLoadStatus) : null;
  const nativeStatusText = !nativeCue ? buildStatusText(storeNativeLoadStatus) : null;

  // Auto-clear "loaded" after 5s so it doesn't linger when a video has no cues.
  useEffect(() => {
    if (storeTargetLoadStatus.state !== 'loaded') return;
    const timer = setTimeout(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'idle' });
    }, 5000);
    return () => clearTimeout(timer);
  }, [storeTargetLoadStatus.state]);

  useEffect(() => {
    if (storeNativeLoadStatus.state !== 'loaded') return;
    const timer = setTimeout(() => {
      useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
    }, 5000);
    return () => clearTimeout(timer);
  }, [storeNativeLoadStatus.state]);

  // Auto-clear "error" after 10s. 'none' persists (Case 70) until SPA nav/user action.
  useEffect(() => {
    if (storeTargetLoadStatus.state !== 'error') return;
    const timer = setTimeout(() => {
      useCuesStore.getState().setLoadStatus('target', { state: 'idle' });
    }, 10000);
    return () => clearTimeout(timer);
  }, [storeTargetLoadStatus.state]);

  useEffect(() => {
    if (storeNativeLoadStatus.state !== 'error') return;
    const timer = setTimeout(() => {
      useCuesStore.getState().setLoadStatus('native', { state: 'idle' });
    }, 10000);
    return () => clearTimeout(timer);
  }, [storeNativeLoadStatus.state]);

  // Apply block settings (globalScale, bgOpacity) from extension popup
  const globalScale = blockSettings?.globalScale ?? 1;
  const blockBgOpacity = blockSettings?.bgOpacity ?? 0.7;
  const blockStyle: React.CSSProperties = {
    transform: `scale(${globalScale})`,
    transformOrigin: 'center',
  };

  // ADR-025: block container luôn render để giữ 3-zone layout shape khi cues rỗng.
  // Layer background chỉ hiện khi có cue → không có subtitle = không có background.
  // Load status (loading/error/none) shows a muted background so the message is readable.
  const hasTargetCue = targetStyle.visible && targetCue;
  const hasNativeCue = nativeStyle.visible && nativeCue;
  const hasTargetStatus = targetStyle.visible && !editable && Boolean(targetStatusText);
  const hasNativeStatus = nativeStyle.visible && !editable && Boolean(nativeStatusText);
  const handleTextBlur = (role: 'target' | 'native', event: React.FocusEvent<HTMLSpanElement>): void => {
    onTextChange?.(role, event.currentTarget.textContent ?? '');
  };

  return (
    <div className={styles.block} style={blockStyle} data-cell-id="subtitle-block">
      <div
        className={styles.layer}
        data-role="target"
        style={{
          ...buildLayerStyle(targetStyle),
          backgroundColor: hasTargetCue
            ? hexToRgba(targetStyle.backgroundColor, targetStyle.backgroundOpacity * blockBgOpacity)
            : hasTargetStatus
              ? hexToRgba(targetStyle.backgroundColor, targetStyle.backgroundOpacity * blockBgOpacity * 0.6)
              : 'transparent',
        }}
      >
        <span
          className={targetStatusText ? styles.statusText : styles.text}
          data-cell-id={editable ? 'overlay-preview-target-line' : undefined}
          contentEditable={editable}
          suppressContentEditableWarning={editable}
          onBlur={editable ? (event) => handleTextBlur('target', event) : undefined}
        >
          {targetText ?? targetStatusText ?? ''}
        </span>
      </div>
      {(hasNativeCue || hasNativeStatus) && (
        <div
          className={styles.layer}
          data-role="native"
          style={{
            ...buildLayerStyle(nativeStyle),
            backgroundColor: hasNativeCue
              ? hexToRgba(nativeStyle.backgroundColor, nativeStyle.backgroundOpacity * blockBgOpacity)
              : hexToRgba(nativeStyle.backgroundColor, nativeStyle.backgroundOpacity * blockBgOpacity * 0.6),
          }}
        >
          <span
            className={nativeStatusText ? styles.statusText : styles.text}
            data-cell-id={editable ? 'overlay-preview-native-line' : undefined}
            contentEditable={editable}
            suppressContentEditableWarning={editable}
            onBlur={editable ? (event) => handleTextBlur('native', event) : undefined}
          >
            {nativeText ?? nativeStatusText ?? ''}
          </span>
        </div>
      )}
    </div>
  );
}

export const SubtitleBlock = memo(SubtitleBlockInner);
