import {
  setupDocking,
  showPanelDocked,
  hidePanelDocked,
  isMobileViewport,
  DESKTOP_VIDEO_RATIO,
  DESKTOP_PANEL_RATIO,
  MOBILE_VIDEO_RATIO,
  MOBILE_PANEL_RATIO,
} from '@/content/subtitleDocking';

function mockRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 300,
    bottom: 200,
    width: 300,
    height: 200,
    x: 0,
    y: 0,
    toJSON: () => {},
    ...rect,
  } as DOMRect);
}

describe('subtitleDocking', () => {
  let video: HTMLVideoElement;
  let panel: HTMLDivElement;
  let originalInnerWidth: number;

  beforeEach(() => {
    document.body.innerHTML = '';
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'video-container');
    document.body.appendChild(container);
    video = document.createElement('video');
    container.appendChild(video);

    panel = document.createElement('div');
    panel.setAttribute('data-testid', 'subtitle-panel');
    panel.style.display = 'none';
    panel.style.position = 'absolute';
    panel.style.right = '0px';
    panel.style.top = '0px';
    panel.style.width = '280px';
    panel.style.maxHeight = '100%';

    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe('setupDocking', () => {
    it('returns f0 and playerContainer without moving the video', () => {
      const container = video.parentElement!;
      // Make container width match video width so it becomes F0.
      mockRect(video, { width: 300, height: 200 });
      mockRect(container, { width: 300, height: 250 });

      const { f0, playerContainer } = setupDocking(video);
      expect(f0).toBe(container);
      // Video is a direct child of container(=F0), so playerContainer = video.
      expect(playerContainer).toBe(video);
      // Video is NOT moved — stays in its original parent.
      expect(video.parentElement).toBe(container);
    });

    it('chooses the farthest width-matching ancestor as F0', () => {
      const container = video.parentElement!;
      const middle = document.createElement('div');
      const f0El = document.createElement('div');
      middle.appendChild(container);
      f0El.appendChild(middle);
      document.body.appendChild(f0El);

      const rect = { width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450, x: 0, y: 0, toJSON: () => {} };
      mockRect(video, rect);
      mockRect(container, { width: 800, height: 500 });
      mockRect(middle, { width: 800, height: 550 });
      mockRect(f0El, rect);

      const { f0, playerContainer } = setupDocking(video);
      expect(f0).toBe(f0El);
      // playerContainer is the direct child of f0 that contains the video.
      expect(playerContainer).toBe(middle);
    });

    it('falls back to video parent when no matching F0 ancestor', () => {
      const container = video.parentElement!;
      mockRect(video, { width: 300, height: 200 });
      mockRect(container, { width: 500, height: 200 });

      const { f0, playerContainer } = setupDocking(video);
      expect(f0).toBe(container);
      expect(playerContainer).toBe(container);
    });
  });

  describe('isMobileViewport', () => {
    it('returns true when innerWidth is 768 or less', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });
      expect(isMobileViewport()).toBe(true);
    });

    it('returns false when innerWidth is greater than 768', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      expect(isMobileViewport()).toBe(false);
    });
  });

  describe('showPanelDocked', () => {
    it('splits playerContainer 70% and panel 30% on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const container = video.parentElement!;
      mockRect(video, { width: 300, height: 200 });
      mockRect(container, { width: 300, height: 250 });
      const { f0, playerContainer } = setupDocking(video);
      f0.appendChild(panel);

      showPanelDocked(f0, playerContainer, panel);

      expect(f0.style.display).toBe('flex');
      expect(f0.style.flexDirection).toBe('row');
      expect(f0.style.boxSizing).toBe('border-box');
      expect(f0.style.height).toBe(`${f0.getBoundingClientRect().height}px`);
      expect(playerContainer.style.flex).toBe(`0 0 ${DESKTOP_VIDEO_RATIO}`);
      expect(playerContainer.style.minWidth).toBe('0');
      expect(playerContainer.style.boxSizing).toBe('border-box');
      expect(playerContainer.style.height).toBe('100%');
      expect(playerContainer.style.getPropertyValue('aspect-ratio')).toBe('auto');
      expect(panel.style.flex).toBe(`0 0 ${DESKTOP_PANEL_RATIO}`);
      expect(panel.style.display).toBe('flex');
      expect(panel.style.position).toBe('relative');
      expect(panel.style.alignSelf).toBe('stretch');
      expect(panel.style.minWidth).toBe('0');
      expect(panel.style.minHeight).toBe('0');
      expect(panel.style.height).toBe('100%');
      expect(panel.style.overflow).toBe('hidden');
      expect(panel.style.boxSizing).toBe('border-box');
      expect(panel.getAttribute('data-docking-mode')).toBe('flex');
    });

    it('stacks playerContainer 60% and panel 40% on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      const container = video.parentElement!;
      mockRect(video, { width: 300, height: 200 });
      mockRect(container, { width: 300, height: 250 });
      const { f0, playerContainer } = setupDocking(video);
      f0.appendChild(panel);

      showPanelDocked(f0, playerContainer, panel);

      expect(f0.style.flexDirection).toBe('column');
      expect(playerContainer.style.flex).toBe(`0 0 ${MOBILE_VIDEO_RATIO}`);
      expect(panel.style.flex).toBe(`0 0 ${MOBILE_PANEL_RATIO}`);
      expect(panel.style.width).toBe('100%');
      expect(panel.style.height).toBe(MOBILE_PANEL_RATIO);
      expect(panel.getAttribute('data-docking-mode')).toBe('flex');
    });
  });

  describe('hidePanelDocked', () => {
    it('restores f0 to default and hides panel', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const container = video.parentElement!;
      mockRect(video, { width: 300, height: 200 });
      mockRect(container, { width: 300, height: 250 });
      const { f0, playerContainer } = setupDocking(video);
      f0.appendChild(panel);

      showPanelDocked(f0, playerContainer, panel);
      hidePanelDocked(f0, playerContainer, panel);

      expect(f0.style.display).toBe('');
      expect(f0.style.flexDirection).toBe('');
      expect(f0.style.boxSizing).toBe('');
      expect(f0.style.height).toBe('');
      expect(playerContainer.style.flex).toBe('');
      expect(playerContainer.style.minWidth).toBe('');
      expect(playerContainer.style.boxSizing).toBe('');
      expect(playerContainer.style.height).toBe('');
      expect(playerContainer.style.getPropertyValue('aspect-ratio')).toBe('');
      expect(panel.style.display).toBe('none');
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.right).toBe('0px');
      expect(panel.style.minWidth).toBe('');
      expect(panel.style.minHeight).toBe('');
      expect(panel.style.overflow).toBe('');
      expect(panel.style.boxSizing).toBe('');
      expect(panel.getAttribute('data-docking-mode')).toBe(null);
    });
  });
});
