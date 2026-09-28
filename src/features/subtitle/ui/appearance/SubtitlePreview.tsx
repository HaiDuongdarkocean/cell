import type { CSSProperties } from 'react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { buildTextShadow, hexToRgba } from '../subtitleUI';
import { t } from '@/shared/i18n';
import styles from './SubtitlePreview.module.css';

interface SubtitlePreviewProps {
  /** Style config to preview (target or native). */
  style: OverlayStyleConfig;
  /** Role label for the preview header. */
  role: 'target' | 'native';
}

/**
 * SubtitlePreview — black bg + white text + apply OverlayStyleConfig realtime
 * (settings-controls-restyle spec F4).
 *
 * Renders a sample text "This is how the {role} subtitle will look." with the
 * current OverlayStyleConfig applied (fontSize, textColor, backgroundColor +
 * alpha, textShadow, fontFamily, opacity). Sits above SubtitleStylePanel in
 * the appearance field so user sees live preview while dragging sliders.
 *
 * Note: yOffsetPercent + horizontalAlign + visible are NOT previewed here —
 * position only makes sense on a real video. This box previews text style only.
 */
export function SubtitlePreview({ style, role }: SubtitlePreviewProps): React.JSX.Element {
  const sampleText = role === 'target' ? t('player.manager.previewTarget') : t('player.manager.previewNative');

  // Convert hex bg + 0-1 opacity → rgba string for the preview background
  const bgRgba = hexToRgba(style.backgroundColor, style.backgroundOpacity);

  const previewStyle: CSSProperties = {
    fontSize: `${style.fontSize}px`,
    color: style.textColor,
    background: bgRgba,
    opacity: style.textOpacity,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight ?? 600,
    textShadow: buildTextShadow(style.textShadow),
  };

  return (
    <div className={styles.previewWrapper}>
      <span className={styles.previewLabel}>{t('subtitle.preview.live')}</span>
      <div className={styles.previewBox} style={previewStyle} data-cell-id={`subtitle-preview-${role}`}>
        {sampleText}
      </div>
    </div>
  );
}

