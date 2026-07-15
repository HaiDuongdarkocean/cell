import { createToggleButton, seekToCue } from '@/features/subtitle/ui/subtitlePanel';
import type { BilingualCue } from '@/types/media';

describe('subtitlePanel', () => {
  let video: HTMLVideoElement;

  const sampleCues: BilingualCue[] = [
    { index: 1, start: 1000, end: 3000, targetText: 'Hello world', nativeText: 'Xin chào' },
    { index: 2, start: 3500, end: 5000, targetText: 'How are you?', nativeText: 'Bạn khỏe không?' },
  ];

  beforeEach(() => {
    video = document.createElement('video');
    document.body.appendChild(video);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createToggleButton', () => {
    it('creates toggle button appended to container', () => {
      const toggleBtn = createToggleButton(video);
      expect(toggleBtn).toBeTruthy();
      expect(toggleBtn.tagName).toBe('BUTTON');
      expect(video.parentElement?.contains(toggleBtn)).toBe(true);
    });

    it('has data-testid for testing', () => {
      const toggleBtn = createToggleButton(video);
      expect(toggleBtn.getAttribute('data-testid')).toBe('panel-toggle');
    });

    it('has ARIA label', () => {
      const toggleBtn = createToggleButton(video);
      expect(toggleBtn.getAttribute('aria-label')).toBe('Toggle subtitle panel');
    });

    it('keeps the border removed when host CSS targets buttons', () => {
      const toggleBtn = createToggleButton(video);
      expect(toggleBtn.style.getPropertyPriority('border')).toBe('important');
    });

    it('has bouncy transform transition matching cluster buttons', () => {
      const toggleBtn = createToggleButton(video);
      expect(toggleBtn.style.transition).toContain('transform');
      expect(toggleBtn.style.transition).toContain('cubic-bezier(0.175, 0.885, 0.32, 1.275)');
    });
  });

  describe('seekToCue', () => {
    it('sets video currentTime to cue start (in seconds)', () => {
      seekToCue(video, sampleCues[0]);
      // start is 1000ms → 1 second
      expect(video.currentTime).toBe(1);
    });

    it('sets video currentTime to second cue start', () => {
      seekToCue(video, sampleCues[1]);
      // start is 3500ms → 3.5 seconds
      expect(video.currentTime).toBe(3.5);
    });
  });
});
