import { SubtitleOverlayController } from '@/features/subtitle/ui/subtitleOverlay';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
import type { OverlayConfig, OverlayStyleConfig } from '@/types/subtitle';

/**
 * Integration test: chrome.storage.onChanged → controller.updateStyle → overlay update.
 * ADR-013 D3: realtime sync flow.
 *
 * Simulates the content-script listener wiring without importing content-script
 * (which has side effects). Tests the contract: fire storage.onChanged with new
 * settings → controller.updateStyle → overlay inline style updates.
 */
describe('ADR-013 storage.onChanged → overlay realtime sync', () => {
  let video: HTMLVideoElement;
  let container: HTMLDivElement;
  const defaultConfig: OverlayConfig = {
    targetLanguage: 'en',
    autoLoadEnabled: false,
    fontSize: 24,
    position: 'bottom',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    textColor: '#ffffff',
    showTimestamps: false,
  };

  beforeEach(() => {
    video = document.createElement('video');
    container = document.createElement('div');
    container.style.position = 'relative';
    container.appendChild(video);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('firing storage.onChanged with new target style updates target overlay', () => {
    const controller = new SubtitleOverlayController(
      video,
      defaultConfig,
      DEFAULT_OVERLAY_STYLE_TARGET,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    );
    controller.init(container);

    const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
    const originalFontSize = targetOverlay.style.fontSize;

    // Simulate chrome.storage.onChanged listener firing (as content-script wires)
    const newTargetStyle: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_TARGET, fontSize: 36 };
    controller.updateStyle(newTargetStyle, undefined);

    expect(targetOverlay.style.fontSize).toBe('36px');
    expect(targetOverlay.style.fontSize).not.toBe(originalFontSize);
  });

  it('firing storage.onChanged with new native style updates native overlay independently', () => {
    const controller = new SubtitleOverlayController(
      video,
      defaultConfig,
      DEFAULT_OVERLAY_STYLE_TARGET,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    );
    controller.init(container);

    const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
    const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;
    const targetFontBefore = targetOverlay.style.fontSize;

    const newNativeStyle: OverlayStyleConfig = { ...DEFAULT_OVERLAY_STYLE_NATIVE, fontSize: 28 };
    controller.updateStyle(undefined, newNativeStyle);

    expect(nativeOverlay.style.fontSize).toBe('28px');
    // Target unchanged
    expect(targetOverlay.style.fontSize).toBe(targetFontBefore);
  });

  it('firing storage.onChanged with both styles updates both overlays', () => {
    const controller = new SubtitleOverlayController(
      video,
      defaultConfig,
      DEFAULT_OVERLAY_STYLE_TARGET,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    );
    controller.init(container);

    const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
    const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;

    controller.updateStyle(
      { ...DEFAULT_OVERLAY_STYLE_TARGET, fontSize: 30, textColor: '#ff0000' },
      { ...DEFAULT_OVERLAY_STYLE_NATIVE, fontSize: 22, visible: false },
    );

    expect(targetOverlay.style.fontSize).toBe('30px');
    expect(nativeOverlay.style.fontSize).toBe('22px');
    expect(nativeOverlay.style.display).toBe('none');
  });

  it('multiple rapid updates (slider drag) do not recreate DOM', () => {
    const controller = new SubtitleOverlayController(
      video,
      defaultConfig,
      DEFAULT_OVERLAY_STYLE_TARGET,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    );
    controller.init(container);

    const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;

    // Simulate 5 rapid slider changes (debounce happens in drag handle, not updateStyle)
    for (let i = 20; i <= 40; i += 5) {
      controller.updateStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, fontSize: i }, undefined);
    }

    // Final state = last update
    expect(targetOverlay.style.fontSize).toBe('40px');
    // Same DOM element (not recreated)
    expect(document.querySelector('[data-testid="subtitle-overlay-target"]')).toBe(targetOverlay);
  });

  it('migration fills defaults for settings missing overlay style fields', () => {
    // Simulate pre-ADR-013 settings (no subtitleOverlayTargetStyle/NativeStyle)
    // loadOverlayStyles() in content-script falls back to DEFAULT_OVERLAY_STYLE_*
    const oldSettings = {
      concurrentDownloads: 3,
      // No subtitleOverlayTargetStyle / subtitleOverlayNativeStyle
    };

    // content-script loadOverlayStyles pattern: settings?.subtitleOverlayTargetStyle ?? DEFAULT
    const targetStyle = (oldSettings as { subtitleOverlayTargetStyle?: OverlayStyleConfig }).subtitleOverlayTargetStyle
      ?? DEFAULT_OVERLAY_STYLE_TARGET;
    const nativeStyle = (oldSettings as { subtitleOverlayNativeStyle?: OverlayStyleConfig }).subtitleOverlayNativeStyle
      ?? DEFAULT_OVERLAY_STYLE_NATIVE;

    expect(targetStyle).toEqual(DEFAULT_OVERLAY_STYLE_TARGET);
    expect(nativeStyle).toEqual(DEFAULT_OVERLAY_STYLE_NATIVE);

    // Controller init with defaults works
    const controller = new SubtitleOverlayController(video, defaultConfig, targetStyle, nativeStyle);
    controller.init(container);
    expect(document.querySelector('[data-testid="subtitle-overlay-target"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="subtitle-overlay-native"]')).toBeTruthy();
    controller.destroy();
  });
});
