import { createOverlay, updateOverlayText, hideOverlay, removeOverlay, createDragHint, showToast } from '../../../src/content/subtitleUI';
import type { OverlayConfig } from '../../../src/types/subtitle';

// jsdom provides document
describe('subtitleUI', () => {
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
    document.body.appendChild(video);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createOverlay', () => {
    it('should create overlay div appended to video parent', () => {
      const overlay = createOverlay(video, defaultConfig);
      expect(overlay).toBeTruthy();
      expect(overlay.tagName).toBe('DIV');
      expect(video.parentElement?.contains(overlay)).toBe(true);
    });

    it('should set data-testid for testing', () => {
      const overlay = createOverlay(video, defaultConfig);
      expect(overlay.getAttribute('data-testid')).toBe('subtitle-overlay');
    });

    it('should apply config styles (fontSize, colors)', () => {
      const overlay = createOverlay(video, defaultConfig);
      expect(overlay.style.fontSize).toBe('24px');
      expect(overlay.style.color).toBe('rgb(255, 255, 255)');
      expect(overlay.style.backgroundColor).toBe('rgba(0, 0, 0, 0.8)');
    });

    it('should position bottom by default', () => {
      const overlay = createOverlay(video, defaultConfig);
      expect(overlay.style.bottom).toBe('10%');
    });

    it('should be hidden initially (empty text)', () => {
      const overlay = createOverlay(video, defaultConfig);
      expect(overlay.textContent).toBe('');
      expect(overlay.style.display).toBe('none');
    });
  });

  describe('updateOverlayText', () => {
    it('should set text and show overlay', () => {
      const overlay = createOverlay(video, defaultConfig);
      updateOverlayText(overlay, 'Hello world');
      expect(overlay.textContent).toBe('Hello world');
      expect(overlay.style.display).toBe('block');
    });
  });

  describe('hideOverlay', () => {
    it('should clear text and hide overlay', () => {
      const overlay = createOverlay(video, defaultConfig);
      updateOverlayText(overlay, 'Hello');
      hideOverlay(overlay);
      expect(overlay.textContent).toBe('');
      expect(overlay.style.display).toBe('none');
    });
  });

  describe('removeOverlay', () => {
    it('should remove overlay from DOM', () => {
      const overlay = createOverlay(video, defaultConfig);
      const parent = overlay.parentElement;
      removeOverlay(overlay);
      expect(parent?.contains(overlay)).toBe(false);
    });
  });

  describe('createDragHint', () => {
    it('should create drag hint div appended to video parent', () => {
      const hint = createDragHint(video);
      expect(hint).toBeTruthy();
      expect(hint.getAttribute('data-testid')).toBe('subtitle-drag-hint');
      expect(video.parentElement?.contains(hint)).toBe(true);
    });

    it('should be hidden initially', () => {
      const hint = createDragHint(video);
      expect(hint.style.display).toBe('none');
    });

    it('should have dashed border for visual feedback', () => {
      const hint = createDragHint(video);
      expect(hint.style.border).toContain('dashed');
    });

    it('should have drop instruction text', () => {
      const hint = createDragHint(video);
      expect(hint.textContent).toContain('Drop subtitle');
    });
  });

  describe('showToast', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should create toast element in video parent', () => {
      showToast('Test message', video);
      const toast = document.querySelector('[data-testid="subtitle-toast"]');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toBe('Test message');
      expect(video.parentElement?.contains(toast)).toBe(true);
    });

    it('should position toast at bottom-center of video', () => {
      showToast('Position test', video);
      const toast = document.querySelector('[data-testid="subtitle-toast"]') as HTMLElement;
      expect(toast.style.position).toBe('absolute');
      expect(toast.style.bottom).toBe('5%');
      expect(toast.style.left).toBe('50%');
      expect(toast.style.transform).toContain('translateX(-50%)');
    });

    it('should auto-remove after 3 seconds', () => {
      jest.useFakeTimers();
      showToast('Auto-hide test', video);
      expect(document.querySelector('[data-testid="subtitle-toast"]')).toBeTruthy();
      jest.advanceTimersByTime(3300);
      expect(document.querySelector('[data-testid="subtitle-toast"]')).toBeNull();
    });
  });
});
