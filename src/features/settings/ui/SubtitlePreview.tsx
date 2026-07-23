import type { CSSProperties } from 'react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
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
  const sampleText = `This is how the ${role} subtitle will look.`;

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
      <span className={styles.previewLabel}>Live Preview</span>
      <div className={styles.previewBox} style={previewStyle} data-testid={`subtitle-preview-${role}`}>
        {sampleText}
      </div>
    </div>
  );
}

/** Convert hex (#rrggbb) + alpha (0-1) → rgba string. Falls back to hex if parse fails. */
function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return hex;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Build CSS text-shadow string from TextShadowConfig. Returns 'none' if preset='none'. */
function buildTextShadow(shadow: OverlayStyleConfig['textShadow']): string {
  if (shadow.preset === 'none') return 'none';
  return `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`;
}
