import { createOverlayLayer, applyStyle } from '@/content/subtitleUI';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';

describe('createOverlayLayer', () => {
  it('creates overlay div with data-role target', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    expect(overlay.getAttribute('data-role')).toBe('target');
    expect(overlay.getAttribute('data-testid')).toBe('subtitle-overlay-target');
  });

  it('creates overlay div with data-role native', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('native', DEFAULT_OVERLAY_STYLE_NATIVE, container);
    expect(overlay.getAttribute('data-role')).toBe('native');
    expect(overlay.getAttribute('data-testid')).toBe('subtitle-overlay-native');
  });

  it('appends overlay to container', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    expect(container.contains(overlay)).toBe(true);
  });

  it('creates text span with user-select text and pointer-events auto', () => {
    const container = document.createElement('div');
    const { textSpan } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    expect(textSpan.style.userSelect).toBe('text');
    expect(textSpan.style.pointerEvents).toBe('auto');
  });

  it('ADR-015: no drag handle button — drag integrated into overlay background', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    // No separate drag handle button element
    expect(overlay.querySelector('[data-testid="overlay-target-drag-handle"]')).toBeNull();
    expect(overlay.querySelector('button')).toBeNull();
  });

  it('ADR-015 D1: overlay has pointer-events auto + cursor ns-resize (background drag affordance)', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    expect(overlay.style.pointerEvents).toBe('auto');
    expect(overlay.style.cursor).toBe('ns-resize');
  });

  it('ADR-015 D2: overlay has ARIA role=slider + per-role aria-label (moved from handle button)', () => {
    const container = document.createElement('div');
    const { overlay: targetOverlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    const { overlay: nativeOverlay } = createOverlayLayer('native', DEFAULT_OVERLAY_STYLE_NATIVE, container);
    expect(targetOverlay.getAttribute('role')).toBe('slider');
    expect(targetOverlay.getAttribute('aria-orientation')).toBe('vertical');
    expect(targetOverlay.getAttribute('aria-valuemin')).toBe('0');
    expect(targetOverlay.getAttribute('aria-valuemax')).toBe('95');
    expect(targetOverlay.getAttribute('aria-label')).toBe('Drag to move target subtitle');
    expect(nativeOverlay.getAttribute('aria-label')).toBe('Drag to move native subtitle');
  });

  it('sets z-index target=999999 > native=999998', () => {
    const container = document.createElement('div');
    const { overlay: targetOverlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    const { overlay: nativeOverlay } = createOverlayLayer('native', DEFAULT_OVERLAY_STYLE_NATIVE, container);
    expect(targetOverlay.style.zIndex).toBe('999999');
    expect(nativeOverlay.style.zIndex).toBe('999998');
  });

  it('overlay hidden initially (display none)', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    expect(overlay.style.display).toBe('none');
  });
});

describe('applyStyle', () => {
  it('sets fontSize in px', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, fontSize: 32 }, overlay);
    expect(overlay.style.fontSize).toBe('32px');
  });

  it('sets textColor', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, textColor: '#ff0000' }, overlay);
    // jsdom normalizes hex color to rgb()
    expect(overlay.style.color).toBe('rgb(255, 0, 0)');
  });

  it('sets backgroundColor via hexToRgba', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, backgroundColor: '#000000', backgroundOpacity: 0.5 }, overlay);
    expect(overlay.style.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('sets textOpacity', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, textOpacity: 0.8 }, overlay);
    expect(overlay.style.opacity).toBe('0.8');
  });

  it('sets textShadow via buildTextShadow', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle(
      {
        ...DEFAULT_OVERLAY_STYLE_TARGET,
        textShadow: { preset: 'cinema', color: '#333', blur: 4, offsetX: 2, offsetY: 2 },
      },
      overlay,
    );
    expect(overlay.style.textShadow).toBe('2px 2px 4px #333');
  });

  it('sets fontFamily via sanitizeFontFamily', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, fontFamily: 'Noto Sans JP, sans-serif' }, overlay);
    expect(overlay.style.fontFamily).toBe('Noto Sans JP, sans-serif');
  });

  it('sets bottom to yOffsetPercent%', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, yOffsetPercent: 25 }, overlay);
    expect(overlay.style.bottom).toBe('25%');
  });

  it('sets textAlign', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, horizontalAlign: 'left' }, overlay);
    expect(overlay.style.textAlign).toBe('left');
  });

  it('sets display none when visible false', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, visible: false }, overlay);
    expect(overlay.style.display).toBe('none');
  });

  it('does not force display block when visible true (timeupdate manages display)', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    // createOverlayLayer sets display:none initially; applyStyle with visible:true
    // must NOT override to block — display stays managed by cue sync.
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, visible: true }, overlay);
    expect(overlay.style.display).toBe('none');
  });

  it('ADR-015 D2: applyStyle updates aria-valuenow directly on overlay (no querySelector handle)', () => {
    const container = document.createElement('div');
    const { overlay } = createOverlayLayer('target', DEFAULT_OVERLAY_STYLE_TARGET, container);
    applyStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, yOffsetPercent: 42 }, overlay);
    expect(overlay.getAttribute('aria-valuenow')).toBe('42');
  });
});
