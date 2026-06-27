import { SubtitleOverlayController } from '../../../src/content/subtitleOverlay';
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

  describe('init', () => {
    it('should create overlay and import button on init', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      expect(document.querySelector('[data-testid="subtitle-overlay"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="subtitle-import-button"]')).toBeTruthy();
    });
  });

  describe('loadCues', () => {
    it('should store cues and show overlay when video time matches', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      const cues: SrtCue[] = [
        { index: 1, start: 0, end: 1000, text: 'Hello' },
        { index: 2, start: 1000, end: 2000, text: 'World' },
      ];
      controller.loadCues(cues);

      // Simulate timeupdate
      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const overlay = document.querySelector('[data-testid="subtitle-overlay"]') as HTMLDivElement;
      expect(overlay.style.display).toBe('block');
      expect(overlay.textContent).toBe('Hello');
    });

    it('should hide overlay when no cue matches', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      const cues: SrtCue[] = [
        { index: 1, start: 0, end: 1000, text: 'Hello' },
      ];
      controller.loadCues(cues);

      // Time outside any cue
      Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const overlay = document.querySelector('[data-testid="subtitle-overlay"]') as HTMLDivElement;
      expect(overlay.style.display).toBe('none');
    });
  });

  describe('clearCues', () => {
    it('should clear cues and hide overlay', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'Hello' }];
      controller.loadCues(cues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      controller.clearCues();

      const overlay = document.querySelector('[data-testid="subtitle-overlay"]') as HTMLDivElement;
      expect(overlay.style.display).toBe('none');
    });
  });

  describe('destroy', () => {
    it('should remove overlay, button, and event listener', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      controller.destroy();

      expect(document.querySelector('[data-testid="subtitle-overlay"]')).toBeNull();
      expect(document.querySelector('[data-testid="subtitle-import-button"]')).toBeNull();
    });
  });

  describe('loadBilingualCues (bilingual runtime align)', () => {
    it('shows target + native when both match current time', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
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

      const targetSpan = document.querySelector('[data-testid="overlay-target"]') as HTMLSpanElement;
      const nativeSpan = document.querySelector('[data-testid="overlay-native"]') as HTMLSpanElement;
      expect(targetSpan.textContent).toBe('Hello');
      expect(nativeSpan.textContent).toBe('Xin chào');
    });

    it('shows target only when native has no cue at current time', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      const targetCues: SrtCue[] = [
        { index: 1, start: 0, end: 2000, text: 'Hello' },
      ];
      const nativeCues: SrtCue[] = [
        { index: 1, start: 3000, end: 4000, text: 'Xin chào' },
      ];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetSpan = document.querySelector('[data-testid="overlay-target"]') as HTMLSpanElement;
      const nativeSpan = document.querySelector('[data-testid="overlay-native"]') as HTMLSpanElement;
      expect(targetSpan.textContent).toBe('Hello');
      expect(nativeSpan.style.display).toBe('none');
    });

    it('shows native only when target has no cue at current time', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      const targetCues: SrtCue[] = [
        { index: 1, start: 3000, end: 4000, text: 'Hello' },
      ];
      const nativeCues: SrtCue[] = [
        { index: 1, start: 0, end: 2000, text: 'Xin chào' },
      ];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetSpan = document.querySelector('[data-testid="overlay-target"]') as HTMLSpanElement;
      const nativeSpan = document.querySelector('[data-testid="overlay-native"]') as HTMLSpanElement;
      expect(targetSpan.style.display).toBe('none');
      expect(nativeSpan.textContent).toBe('Xin chào');
    });

    it('hides overlay when neither target nor native has a cue at current time', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      const targetCues: SrtCue[] = [
        { index: 1, start: 0, end: 1000, text: 'Hello' },
      ];
      const nativeCues: SrtCue[] = [
        { index: 1, start: 0, end: 1000, text: 'Xin chào' },
      ];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const overlay = document.querySelector('[data-testid="subtitle-overlay"]') as HTMLDivElement;
      expect(overlay.style.display).toBe('none');
    });

    it('does not update DOM when neither target nor native index changes', () => {
      const controller = new SubtitleOverlayController(video, defaultConfig);
      controller.init();
      const targetCues: SrtCue[] = [
        { index: 1, start: 0, end: 2000, text: 'Hello' },
      ];
      const nativeCues: SrtCue[] = [
        { index: 1, start: 0, end: 2000, text: 'Xin chào' },
      ];
      controller.loadBilingualCues(targetCues, nativeCues);

      Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      const targetSpan = document.querySelector('[data-testid="overlay-target"]') as HTMLSpanElement;
      targetSpan.textContent = 'MUTATED';

      // Same cue still active → no re-render → text stays mutated.
      Object.defineProperty(video, 'currentTime', { value: 0.8, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));

      expect(targetSpan.textContent).toBe('MUTATED');
    });
  });
});
