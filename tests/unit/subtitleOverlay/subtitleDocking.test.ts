import { createDockingWrapper, showPanelDocked, hidePanelDocked, isMobileViewport } from '@/content/subtitleDocking';

function mockVideoRect(video: HTMLVideoElement, rect: Partial<DOMRect>): void {
  Object.defineProperty(video, 'getBoundingClientRect', {
    value: () => ({
      left: 100,
      top: 50,
      right: 400,
      bottom: 300,
      width: 300,
      height: 250,
      x: 100,
      y: 50,
      toJSON: () => {},
      ...rect,
    }),
    configurable: true,
  });
}

describe('subtitleDocking', () => {
  let video: HTMLVideoElement;
  let panel: HTMLDivElement;
  let toggle: HTMLButtonElement;
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

    toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'panel-toggle');

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

  describe('createDockingWrapper', () => {
    it('creates wrapper div and moves video into it', () => {
      const wrapper = createDockingWrapper(video);
      expect(wrapper).toBeTruthy();
      expect(wrapper.getAttribute('data-testid')).toBe('subtitle-docking-wrapper');
      expect(wrapper.contains(video)).toBe(true);
      expect(video.parentElement).toBe(wrapper);
    });

    it('leaves wrapper as sibling of video\'s original parent content', () => {
      const container = video.parentElement;
      const wrapper = createDockingWrapper(video);
      expect(container?.firstChild).toBe(wrapper);
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
    it('sets wrapper flex row and shrinks video to 70% on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const wrapper = createDockingWrapper(video);
      wrapper.appendChild(panel);
      wrapper.appendChild(toggle);

      showPanelDocked(wrapper, video, panel);

      expect(wrapper.style.display).toBe('flex');
      expect(wrapper.style.flexDirection).toBe('row');
      expect(video.style.width).toBe('70%');
      expect(video.style.height).toBe('auto');
      expect(panel.style.display).toBe('flex');
      expect(panel.style.width).toBe('280px');
      expect(panel.style.height).toBe('100%');
      expect(panel.style.position).toBe('relative');
    });

    it('sets wrapper flex column and splits video/panel 60/40 on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      const wrapper = createDockingWrapper(video);
      wrapper.appendChild(panel);
      wrapper.appendChild(toggle);

      showPanelDocked(wrapper, video, panel);

      expect(wrapper.style.flexDirection).toBe('column');
      expect(video.style.width).toBe('100%');
      expect(video.style.height).toBe('60%');
      expect(panel.style.width).toBe('100%');
      expect(panel.style.height).toBe('40%');
      expect(panel.style.maxHeight).toBe('40%');
    });
  });

  describe('hidePanelDocked', () => {
    it('falls back to fixed positioning when video is absolutely positioned', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const wrapper = createDockingWrapper(video);
      wrapper.appendChild(panel);
      wrapper.appendChild(toggle);
      video.style.position = 'absolute';
      mockVideoRect(video, { left: 100, top: 50, right: 400, bottom: 300, width: 300, height: 250 });

      showPanelDocked(wrapper, video, panel);

      expect(panel.style.position).toBe('fixed');
      expect(panel.style.left).toBe('400px');
      expect(panel.style.top).toBe('50px');
      expect(panel.style.width).toBe('280px');
      expect(panel.style.height).toBe('250px');
      expect(panel.getAttribute('data-docking-mode')).toBe('fixed');
    });

    it('places fixed panel on the left when right side overflows viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      const wrapper = createDockingWrapper(video);
      wrapper.appendChild(panel);
      wrapper.appendChild(toggle);
      video.style.position = 'absolute';
      mockVideoRect(video, { left: 300, top: 50, right: 450, bottom: 300, width: 150, height: 250 });

      showPanelDocked(wrapper, video, panel);

      expect(panel.style.position).toBe('fixed');
      expect(panel.style.left).toBe('20px'); // 300 - 280
      expect(panel.style.top).toBe('50px');
    });

    it('restores wrapper to block and hides panel', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const wrapper = createDockingWrapper(video);
      wrapper.appendChild(panel);
      wrapper.appendChild(toggle);

      showPanelDocked(wrapper, video, panel);
      hidePanelDocked(wrapper, video, panel);

      expect(wrapper.style.display).toBe('block');
      expect(video.style.width).toBe('100%');
      expect(video.style.height).toBe('auto');
      expect(panel.style.display).toBe('none');
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.right).toBe('0px');
    });
  });
});
