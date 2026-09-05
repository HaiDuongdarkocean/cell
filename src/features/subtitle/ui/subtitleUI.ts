import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';
import type { NavClusterSettings } from '@/entities/media';
import type { CSSProperties } from 'react';
import { ICON_CATALOG } from '@/shared/icons';
import { mountToWatchVideo } from './netflixPlayback';

// === Pure style helpers (ADR-013 D6) ===
// Logic ở pure function — testable 100%, no DOM side effect.

/**
 * Build CSS text-shadow string from config.
 * 3 preset (none/soft/cinema) + custom (offsetX/offsetY/blur/color).
 * Pure — no DOM access.
 */
export function buildTextShadow(config: TextShadowConfig): string {
  if (config.preset === 'none') return 'none';
  if (config.preset === 'soft') return `var(--shadow-textSoft) ${config.color}`;
  if (config.preset === 'cinema') return `var(--shadow-textCinema) ${config.color}`;
  return `${config.offsetX}px ${config.offsetY}px ${config.blur}px ${config.color}`;
}

/**
 * Build CSS custom properties for cluster button sizing/opacity from NavClusterSettings.
 * Single source of truth — used by NavCluster (navLayer), SubtitlePanels (clusterRight),
 * PlayerModeOverlay (clusterRight), and OverlayPreview (toolbar).
 *
 * buttonSize uses clamp for auto-responsive scaling (65%→100% based on container width via cqw).
 * Pure — no DOM access.
 */
export function buildClusterCssVars(settings?: NavClusterSettings): CSSProperties {
  const buttonSize = settings?.buttonSize ?? 34;
  const textOpacity = settings?.textOpacity ?? 1;
  const bgOpacity = settings?.bgOpacity ?? 0.2;
  const hoverAlpha = Math.min(bgOpacity + 0.06, 1);
  const activeAlpha = Math.min(bgOpacity + 0.12, 1);
  return {
    '--cluster-btn-size': `clamp(${Math.round(buttonSize * 0.65)}px, ${Math.round(buttonSize * 0.15)}cqw, ${buttonSize}px)`,
    '--cluster-icon-size': `clamp(${Math.round(buttonSize * 0.35)}px, ${Math.round(buttonSize * 0.082)}cqw, 20px)`,
    '--cluster-text-opacity': String(textOpacity),
    '--cluster-bg-opacity': String(bgOpacity),
    // Protected-overlay material: shared IconButton owns the geometry,
    // but the cluster scope remaps the liquid tokens so the same
    // component renders dark glass on top of video.
    '--iconbutton-liquid-surface': `rgba(10, 16, 26, ${bgOpacity})`,
    '--iconbutton-liquid-surface-hover': `rgba(14, 22, 34, ${hoverAlpha})`,
    '--iconbutton-liquid-surface-active': `rgba(14, 22, 34, ${activeAlpha})`,
    '--iconbutton-liquid-foreground': `rgba(247, 248, 248, ${textOpacity})`,
    '--iconbutton-liquid-specular': 'rgba(255, 255, 255, 0.55)',
    '--iconbutton-liquid-caustic': 'rgba(160, 184, 220, 0.42)',
    '--iconbutton-liquid-inner-shadow': 'rgba(0, 0, 0, 0.3)',
    '--iconbutton-liquid-contact-shadow': 'rgba(0, 0, 0, 0.2)',
    '--iconbutton-liquid-focus-ring': 'rgba(255, 255, 255, 0.35)',
    '--iconbutton-liquid-backdrop-blur': 'var(--blur-lg)',
  } as CSSProperties;
}

/**
 * Sanitize CSS font-family string.
 * Blocks url()/@import/expression()/javascript: (security — no font loading exploit).
 * Falls back to 'sans-serif' for empty/invalid input.
 * Pure — no DOM access.
 */
export function sanitizeFontFamily(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'sans-serif';
  // Block dangerous patterns (font loading exploit, XSS via expression)
  if (/url\(|@import|expression|javascript:/i.test(trimmed)) return 'sans-serif';
  return trimmed;
}

/**
 * Convert hex color + alpha to rgba string.
 * Supports 3-digit and 6-digit hex (with or without leading #).
 * Falls back to a token-based overlay background color for invalid hex.
 * Pure — no DOM access.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  const pct = Math.round(alpha * 100);
  const fallback = `color-mix(in srgb, var(--color-overlay-background) ${pct}%, transparent)`;
  if (normalized.length !== 3 && normalized.length !== 6) return fallback;
  let r = 0, g = 0, b = 0;
  if (normalized.length === 3) {
    r = parseInt(normalized[0] + normalized[0], 16);
    g = parseInt(normalized[1] + normalized[1], 16);
    b = parseInt(normalized[2] + normalized[2], 16);
  } else {
    r = parseInt(normalized.slice(0, 2), 16);
    g = parseInt(normalized.slice(2, 4), 16);
    b = parseInt(normalized.slice(4, 6), 16);
  }
  // NaN guard — fallback to token-based overlay color
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// === Overlay layer (ADR-013 D1, ADR-015 D1-D3) ===
// 2 div độc lập (target + native), mỗi cái 1 text span.
// ADR-015: drag tích hợp trực tiếp vào overlay background (xóa handle button riêng).
// Text span giữ user-select: text + pointer-events: auto cho select text + tra cứu.

/**
 * Create 1 overlay layer độc lập (target OR native) — ADR-013 D1, ADR-015 D1-D3.
 * Returns overlay div + text span. Overlay is the drag target (background drag),
 * text span keeps select-text + dictionary lookup.
 *
 * @param role - 'target' | 'native'
 * @param config - Per-layer appearance (OverlayStyleConfig)
 * @param container - Video wrapper (overlay append here, fullscreen-safe)
 */
export function createOverlayLayer(
  role: 'target' | 'native',
  config: OverlayStyleConfig,
  container: HTMLElement,
): { overlay: HTMLDivElement; textSpan: HTMLSpanElement } {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-role', role);
  overlay.setAttribute('data-cell-id', `subtitle-overlay-${role}`);
  overlay.className = 'subtitle-overlay';

  // ARIA slider on overlay div (ADR-015 D2 — moved from handle button)
  overlay.setAttribute('role', 'slider');
  overlay.setAttribute('aria-label', `Subtitle ${role}`);
  overlay.setAttribute('aria-orientation', 'vertical');
  overlay.setAttribute('aria-valuemin', '0');
  overlay.setAttribute('aria-valuemax', '95');

  // Text span: user-select text (copy word), pointer-events auto
  const textSpan = document.createElement('span');
  textSpan.setAttribute('data-cell-id', `overlay-${role}-text`);
  textSpan.className = 'subtitle-overlay-text';
  overlay.appendChild(textSpan);

  // Apply initial style
  applyStyle(config, overlay);

  // Hidden initially (cue sync will show when text arrives)
  overlay.style.display = 'none';

  container.appendChild(overlay);
  return { overlay, textSpan };
}

/**
 * Apply OverlayStyleConfig to overlay div via inline style — ADR-013 D6.
 * Thin wrapper: logic ở pure function (buildTextShadow, sanitizeFontFamily, hexToRgba).
 * O(1) set inline style, không recreate DOM.
 */
export function applyStyle(config: OverlayStyleConfig, overlay: HTMLDivElement): void {
  overlay.style.fontSize = `${config.fontSize}px`;
  overlay.style.color = config.textColor;
  overlay.style.backgroundColor = hexToRgba(config.backgroundColor, config.backgroundOpacity);
  overlay.style.opacity = String(config.textOpacity);
  overlay.style.textShadow = buildTextShadow(config.textShadow);
  overlay.style.fontFamily = sanitizeFontFamily(config.fontFamily);
  overlay.style.textAlign = config.horizontalAlign;
  // G7: re-apply line-height guard whenever style is refreshed; host CSS may
  // have overridden it via !important or high-specificity selectors.
  // Inline style with !important wins over any CSS class rule.
  overlay.style.setProperty('line-height', 'var(--subtitle-line-height, var(--leading-snug))', 'important');
  // Only hide when visible=false. When visible=true, do NOT force display:block —
  // display is managed by timeupdate (updateOverlayText/hideOverlay) based on
  // current cue. Forcing block here shows drag handle with no subtitle (bug fix).
  if (!config.visible) overlay.style.display = 'none';
}

/**
 * Update overlay text and show it.
 * ADR-013: finds text span in overlay layer (data-cell-id="overlay-{role}-text").
 * Falls back to overlay.textContent if span not found (legacy compat).
 */
export function updateOverlayText(overlay: HTMLDivElement, text: string): void {
  const span = overlay.querySelector('span[data-cell-id]') as HTMLSpanElement | null;
  if (span) {
    span.textContent = text;
  } else {
    overlay.textContent = text;
  }
  overlay.style.display = 'block';
}

/**
 * Clear text and hide overlay.
 * Clears text span (bilingual-safe — each overlay layer has 1 span).
 */
export function hideOverlay(overlay: HTMLDivElement): void {
  const span = overlay.querySelector('span[data-cell-id]') as HTMLSpanElement | null;
  if (span) {
    span.textContent = '';
  }
  overlay.style.display = 'none';
}

/**
 * Remove overlay from DOM.
 */
export function removeOverlay(overlay: HTMLDivElement): void {
  overlay.remove();
}

/**
 * Create drag hint overlay — semi-transparent full-cover with dashed border.
 * Shown on dragenter, hidden on dragleave/drop.
 * ponytail: counter-based to avoid flicker from nested dragenter/dragleave events.
 */
export function createDragHint(container: HTMLElement): HTMLDivElement {
  const hint = document.createElement('div');
  hint.setAttribute('data-cell-id', 'subtitle-drag-hint');
  hint.className = 'subtitle-drag-hint';
  hint.textContent = 'Drop subtitle file here';

  container.appendChild(hint);
  // ADR-031: Netflix z-index fix — drag hint must sit above Netflix overlays.
  mountToWatchVideo(hint, container);
  return hint;
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
}

const ICONS: Record<ToastVariant, string> = {
  success: ICON_CATALOG.check.svg,
  error: ICON_CATALOG.x.svg,
  warning: ICON_CATALOG.triangleAlert.svg,
  info: ICON_CATALOG.circleInfo.svg,
};

const VARIANT_COLORS: Record<ToastVariant, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

/**
 * Show a temporary toast notification at bottom-center of video (UI v4).
 * Matches docs/mockups/subtitle-selector-mockup.html: bottom 30%, theme tokens,
 * bordered card. Auto-hides after 3 seconds.
 * ponytail: position absolute in video parent (same pattern as overlay/dragHint),
 * not fixed viewport — toast stays anchored to video even on scroll.
 */
export function showToast(message: string, container: HTMLElement, options: ToastOptions = {}): void {
  const { variant = 'info' } = options;
  const color = VARIANT_COLORS[variant];

  const toast = document.createElement('div');
  toast.setAttribute('data-cell-id', 'subtitle-toast');
  toast.setAttribute('data-variant', variant);
  toast.className = 'subtitle-toast';
  toast.style.setProperty('--toast-variant-color', color);

  const icon = document.createElement('span');
  icon.className = 'subtitle-toast-icon';
  icon.innerHTML = ICONS[variant];
  toast.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('subtitle-toast--fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Create a trailing-debounced toast wrapper (ADR-015).
 *
 * Rapid calls within `delayMs` collapse into a single toast showing the
 * most recent message + variant. This prevents spam when the user rapidly
 * switches subtitles or imports multiple files in quick succession.
 *
 * @param showToast - Base toast function `(message, container, options?) => void`
 * @param delayMs - Debounce delay in milliseconds (default 500)
 * @returns Debounced toast function
 */
export function createDebouncedToast(
  showToast: (message: string, container: HTMLElement, options?: ToastOptions) => void,
  delayMs = 500,
): (message: string, container: HTMLElement, options?: ToastOptions) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastMessage: string | null = null;
  let lastContainer: HTMLElement | null = null;
  let lastOptions: ToastOptions | undefined;

  return (message: string, container: HTMLElement, options?: ToastOptions): void => {
    lastMessage = message;
    lastContainer = container;
    lastOptions = options;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      if (lastMessage !== null && lastContainer !== null) {
        showToast(lastMessage, lastContainer, lastOptions);
      }
      timeoutId = null;
    }, delayMs);
  };
}
