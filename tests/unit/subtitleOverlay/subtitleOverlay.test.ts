import { SubtitleOverlayController } from '../../../src/content/subtitleOverlay';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/constants/config';
import type { OverlayConfig } from '../../../src/types/subtitle';
import type { SrtCue } from '../../../src/types/media';

describe('SubtitleOverlayController', () => {
  let video: HTMLVideoElement;
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
    // Mock video parent with relative positioning for overlay
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.appendChild(video);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Helper: create controller with default styles (ADR-013: 4-param constructor)
  function makeController(): SubtitleOverlayController {
    return new SubtitleOverlayController(
      video,
      defaultConfig,
      DEFAULT_OVERLAY_STYLE_TARGET,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    );
  }

  describe('init', () => {
    it('should create 2 overlay layer (target + native) and import button on init', () => {
      const controller = makeController();
      controller.init();
      // ADR-013: 2 overlay div độc lập (thay 1 div chung)
      expect(document.querySelector('[data-testid="subtitle-overlay-target"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="subtitle-overlay-native"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="subtitle-import-button"]')).toBeTruthy();
    });
  });

  describe('loadCues (single mode)', () => {
    it('should store cues and show target overlay when video time matches', () => {
      const controller = makeController();
      controller.init();
      const cues: SrtCue[] = [
        { index: 1, start: 0, end: 1000, text: 'Hello' },
        { index: 2, start: 1000, end: 2000, text: 'World' },
      ];
      controller.loadCues(cues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
      expect(targetOverlay.style.display).toBe('block');
      const targetSpan = document.querySelector('[data-testid="overlay-target-text"]') as HTMLSpanElement;
      expect(targetSpan.textContent).toBe('Hello');
    });

    it('should hide target overlay when no cue matches', () => {
      const controller = makeController();
      controller.init();
      const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Hello' }];
      controller.loadCues(cues);

      Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
      expect(targetOverlay.style.display).toBe('none');
    });

    it('should hide native overlay in single mode', () => {
      const controller = makeController();
      controller.init();
      const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Hello' }];
      controller.loadCues(cues);

      const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;
      expect(nativeOverlay.style.display).toBe('none');
    });
  });

  describe('clearCues', () => {
    it('should clear cues and hide both overlays', () => {
      const controller = makeController();
      controller.init();
      const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Hello' }];
      controller.loadCues(cues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      controller.clearCues();

      const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
      const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;
      expect(targetOverlay.style.display).toBe('none');
      expect(nativeOverlay.style.display).toBe('none');
    });
  });

  describe('destroy', () => {
    it('should remove both overlays, button, and event listener', () => {
      const controller = makeController();
      controller.init();
      controller.destroy();

      expect(document.querySelector('[data-testid="subtitle-overlay-target"]')).toBeNull();
      expect(document.querySelector('[data-testid="subtitle-overlay-native"]')).toBeNull();
      expect(document.querySelector('[data-testid="subtitle-import-button"]')).toBeNull();
    });
  });

  describe('loadBilingualCues (bilingual runtime align, ADR-013: 2 div độc lập)', () => {
    it('shows target + native in separate div when both match current time', () => {
      const controller = makeController();
      controller.init();
      const targetCues: SrtCue[] = [
        { index: 1, start: 0, end: 1000, text: 'Hello' },
        { index: 2, start: 1000, end: 2000, text: 'World' },
      ];
      const nativeCues: SrtCue[] = [
        { index: 1, start: 0, end: 1000, text: 'Xin chào' },
        { index: 2, start: 1000, end: 2000, text: 'Thế giới' },
      ];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetSpan = document.querySelector('[data-testid="overlay-target-text"]') as HTMLSpanElement;
      const nativeSpan = document.querySelector('[data-testid="overlay-native-text"]') as HTMLSpanElement;
      expect(targetSpan.textContent).toBe('Hello');
      expect(nativeSpan.textContent).toBe('Xin chào');
    });

    it('shows target only when native has no cue at current time', () => {
      const controller = makeController();
      controller.init();
      const targetCues: SrtCue[] = [{ index: 1, start: 0, end: 2000, text: 'Hello' }];
      const nativeCues: SrtCue[] = [{ index: 1, start: 3000, end: 4000, text: 'Xin chào' }];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
      const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;
      expect(targetOverlay.style.display).toBe('block');
      expect(nativeOverlay.style.display).toBe('none');
    });

    it('shows native only when target has no cue at current time', () => {
      const controller = makeController();
      controller.init();
      const targetCues: SrtCue[] = [{ index: 1, start: 3000, end: 4000, text: 'Hello' }];
      const nativeCues: SrtCue[] = [{ index: 1, start: 0, end: 2000, text: 'Xin chào' }];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
      const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;
      expect(targetOverlay.style.display).toBe('none');
      expect(nativeOverlay.style.display).toBe('block');
    });

    it('hides both overlays when neither target nor native has a cue at current time', () => {
      const controller = makeController();
      controller.init();
      const targetCues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Hello' }];
      const nativeCues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Xin chào' }];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;
      const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;
      expect(targetOverlay.style.display).toBe('none');
      expect(nativeOverlay.style.display).toBe('none');
    });

    it('does not update DOM when neither target nor native index changes', () => {
      const controller = makeController();
      controller.init();
      const targetCues: SrtCue[] = [{ index: 1, start: 0, end: 2000, text: 'Hello' }];
      const nativeCues: SrtCue[] = [{ index: 1, start: 0, end: 2000, text: 'Xin chào' }];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetSpan = document.querySelector('[data-testid="overlay-target-text"]') as HTMLSpanElement;
      targetSpan.textContent = 'MUTATED';

      // Same cue still active → no re-render → text stays mutated.
      Object.defineProperty(video, 'currentTime', { value: 0.8, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      expect(targetSpan.textContent).toBe('MUTATED');
    });
  });

  describe('updateStyle (ADR-013 D3)', () => {
    it('updates target overlay style without recreating DOM', () => {
      const controller = makeController();
      controller.init();
      const targetOverlay = document.querySelector('[data-testid="subtitle-overlay-target"]') as HTMLDivElement;

      controller.updateStyle({ ...DEFAULT_OVERLAY_STYLE_TARGET, fontSize: 36 }, undefined);

      expect(targetOverlay.style.fontSize).toBe('36px');
      // Overlay element should be the same (not recreated)
      expect(document.querySelector('[data-testid="subtitle-overlay-target"]')).toBe(targetOverlay);
    });

    it('updates native overlay style independently', () => {
      const controller = makeController();
      controller.init();
      const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;

      controller.updateStyle(undefined, { ...DEFAULT_OVERLAY_STYLE_NATIVE, fontSize: 28 });

      expect(nativeOverlay.style.fontSize).toBe('28px');
    });

    it('hides native overlay when visible=false', () => {
      const controller = makeController();
      controller.init();
      const nativeOverlay = document.querySelector('[data-testid="subtitle-overlay-native"]') as HTMLDivElement;

      controller.updateStyle(undefined, { ...DEFAULT_OVERLAY_STYLE_NATIVE, visible: false });

      expect(nativeOverlay.style.display).toBe('none');
    });
  });
});
