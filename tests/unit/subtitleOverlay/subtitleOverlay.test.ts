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
});
