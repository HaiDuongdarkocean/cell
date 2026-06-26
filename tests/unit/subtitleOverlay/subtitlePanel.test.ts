import { createPanel, renderCueList, createToggleButton, switchPanelPosition, highlightCue, scrollToCue, seekToCue } from '@/content/subtitlePanel';
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

  describe('createPanel', () => {
    it('creates panel div appended to video parent', () => {
      const panel = createPanel(video);
      expect(panel).toBeTruthy();
      expect(panel.tagName).toBe('DIV');
      expect(video.parentElement?.contains(panel)).toBe(true);
    });

    it('sets data-testid for testing', () => {
      const panel = createPanel(video);
      expect(panel.getAttribute('data-testid')).toBe('subtitle-panel');
    });

    it('has semi-transparent background', () => {
      const panel = createPanel(video);
      expect(panel.style.backgroundColor).toContain('rgba(20, 20, 20, 0.85)');
    });

    it('has fixed width 280px', () => {
      const panel = createPanel(video);
      expect(panel.style.width).toBe('280px');
    });

    it('is positioned absolute', () => {
      const panel = createPanel(video);
      expect(panel.style.position).toBe('absolute');
    });

    it('defaults to right position', () => {
      const panel = createPanel(video);
      expect(panel.style.right).toBe('0px');
    });

    it('has header with title "Subtitles"', () => {
      const panel = createPanel(video);
      const header = panel.querySelector('[data-testid="panel-header"]');
      expect(header).toBeTruthy();
      expect(header?.textContent).toContain('Subtitles');
    });

    it('has drag handle in header', () => {
      const panel = createPanel(video);
      const dragHandle = panel.querySelector('[data-testid="panel-drag-handle"]');
      expect(dragHandle).toBeTruthy();
    });

    it('has close button in header', () => {
      const panel = createPanel(video);
      const closeBtn = panel.querySelector('[data-testid="panel-close"]');
      expect(closeBtn).toBeTruthy();
    });

    it('has scrollable body for cue list', () => {
      const panel = createPanel(video);
      const body = panel.querySelector('[data-testid="panel-body"]');
      expect(body).toBeTruthy();
      expect((body as HTMLElement).style.overflowY).toBe('auto');
    });

    it('has ARIA labels for accessibility', () => {
      const panel = createPanel(video);
      expect(panel.getAttribute('role')).toBe('complementary');
      expect(panel.getAttribute('aria-label')).toBe('Subtitle list');
    });

    it('is hidden initially', () => {
      const panel = createPanel(video);
      expect(panel.style.display).toBe('none');
    });
  });

  describe('renderCueList', () => {
    it('renders cue items in panel body', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      const items = panel.querySelectorAll('[data-testid="cue-item"]');
      expect(items).toHaveLength(2);
    });

    it('each item has timestamp', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      const timestamps = panel.querySelectorAll('[data-testid="cue-timestamp"]');
      expect(timestamps).toHaveLength(2);
      expect(timestamps[0].textContent).toContain('00:00:01');
    });

    it('each item has target text', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      const targetTexts = panel.querySelectorAll('[data-testid="cue-target-text"]');
      expect(targetTexts).toHaveLength(2);
      expect(targetTexts[0].textContent).toBe('Hello world');
    });

    it('each item has native text', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      const nativeTexts = panel.querySelectorAll('[data-testid="cue-native-text"]');
      expect(nativeTexts).toHaveLength(2);
      expect(nativeTexts[0].textContent).toBe('Xin chào');
    });

    it('target text is prominent (14px, white)', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      const targetText = panel.querySelector('[data-testid="cue-target-text"]') as HTMLElement;
      expect(targetText.style.fontSize).toBe('14px');
      expect(targetText.style.color).toBe('rgb(255, 255, 255)');
    });

    it('native text is muted (12px, dimmer)', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      const nativeText = panel.querySelector('[data-testid="cue-native-text"]') as HTMLElement;
      expect(nativeText.style.fontSize).toBe('12px');
      expect(nativeText.style.color).toContain('rgba(255, 255, 255, 0.6)');
    });

    it('timestamp is clickable (has data-cue-index)', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      const timestamp = panel.querySelector('[data-testid="cue-timestamp"]') as HTMLElement;
      expect(timestamp.getAttribute('data-cue-index')).toBe('1');
      expect(timestamp.style.cursor).toBe('pointer');
    });

    it('handles empty cues array', () => {
      const panel = createPanel(video);
      renderCueList(panel, []);
      const items = panel.querySelectorAll('[data-testid="cue-item"]');
      expect(items).toHaveLength(0);
    });

    it('handles cue with empty nativeText', () => {
      const panel = createPanel(video);
      const singleLangCues: BilingualCue[] = [
        { index: 1, start: 1000, end: 3000, targetText: 'Hello', nativeText: '' },
      ];
      renderCueList(panel, singleLangCues);
      const nativeText = panel.querySelector('[data-testid="cue-native-text"]') as HTMLElement;
      expect(nativeText.textContent).toBe('');
    });
  });

  describe('createToggleButton', () => {
    it('creates toggle button appended to video parent', () => {
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
  });

  describe('switchPanelPosition', () => {
    it('switches from right to left', () => {
      const panel = createPanel(video);
      switchPanelPosition(panel, 'left');
      expect(panel.style.left).toBe('0px');
      expect(panel.style.right).toBe('');
    });

    it('switches from left to right', () => {
      const panel = createPanel(video);
      switchPanelPosition(panel, 'left');
      switchPanelPosition(panel, 'right');
      expect(panel.style.right).toBe('0px');
      expect(panel.style.left).toBe('');
    });
  });

  describe('highlightCue', () => {
    it('highlights cue item by index', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      highlightCue(panel, 1);
      const item = panel.querySelector('[data-cue-index="1"]') as HTMLElement;
      expect(item.style.backgroundColor).toContain('rgba(0, 150, 255, 0.3)');
    });

    it('removes highlight from previously highlighted cue', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      highlightCue(panel, 1);
      highlightCue(panel, 2);
      const item1 = panel.querySelector('[data-cue-index="1"]') as HTMLElement;
      const item2 = panel.querySelector('[data-cue-index="2"]') as HTMLElement;
      expect(item1.style.backgroundColor).not.toContain('rgba(0, 150, 255');
      expect(item2.style.backgroundColor).toContain('rgba(0, 150, 255, 0.3)');
    });

    it('does nothing if cue index not found', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      // Should not throw
      expect(() => highlightCue(panel, 999)).not.toThrow();
    });

    it('does nothing if panel body is empty', () => {
      const panel = createPanel(video);
      expect(() => highlightCue(panel, 1)).not.toThrow();
    });
  });

  describe('scrollToCue', () => {
    it('scrolls cue item into view', () => {
      // jsdom doesn't implement scrollIntoView, define then spy
      Element.prototype.scrollIntoView = jest.fn();
      const scrollSpy = jest.spyOn(Element.prototype, 'scrollIntoView');
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      scrollToCue(panel, 1);
      expect(scrollSpy).toHaveBeenCalled();
      scrollSpy.mockRestore();
    });

    it('does nothing if cue index not found', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      expect(() => scrollToCue(panel, 999)).not.toThrow();
    });
  });

  describe('seekToCue', () => {
    it('sets video currentTime to cue start (in seconds)', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      seekToCue(video, sampleCues[0]);
      // start is 1000ms → 1 second
      expect(video.currentTime).toBe(1);
    });

    it('sets video currentTime to second cue start', () => {
      const panel = createPanel(video);
      renderCueList(panel, sampleCues);
      seekToCue(video, sampleCues[1]);
      // start is 3500ms → 3.5 seconds
      expect(video.currentTime).toBe(3.5);
    });
  });
});
