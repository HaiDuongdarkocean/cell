import type { ReactElement } from 'react';
import type { OverlayStyleConfig } from '@/types/subtitle';
import { buildTextShadow, sanitizeFontFamily, hexToRgba } from '@/features/subtitle/ui/subtitleUI';
import styles from './SubtitlePreview.module.css';

interface SubtitlePreviewProps {
  /** Style config to preview (target or native). */
  style: OverlayStyleConfig;
  /** Role label for the preview header. */
  role: 'target' | 'native';
}

/**
 * Live preview of subtitle overlay appearance (ADR-013).
 * Renders a text sample with the style applied via inline style.
 * Dark/light background toggle simulates video backdrop (light vs dark scene).
 *
 * Note: Preview shows font/color/shadow only. Position (yOffsetPercent) is
 * visible on the actual video, not here (preview is a fixed sample box).
 */
export function SubtitlePreview({ style, role }: SubtitlePreviewProps): ReactElement {
  const previewStyle: React.CSSProperties = {
    fontSize: `${style.fontSize}px`,
    color: style.textColor,
    backgroundColor: hexToRgba(style.backgroundColor, style.backgroundOpacity),
    opacity: style.textOpacity,
    textShadow: buildTextShadow(style.textShadow),
    fontFamily: sanitizeFontFamily(style.fontFamily),
    textAlign: style.horizontalAlign,
  };

  return (
    <div className={styles.container} data-testid={`subtitle-preview-${role}`}>
      <div className={styles.previewBox}>
        <span style={previewStyle} className={styles.sampleText}>
          {role === 'target' ? 'Hello world — target subtitle sample' : 'Xin chào — native subtitle sample'}
        </span>
      </div>
      <p className={styles.note}>
        Preview shows font/color/shadow only. Position visible on video.
      </p>
    </div>
  );
}
