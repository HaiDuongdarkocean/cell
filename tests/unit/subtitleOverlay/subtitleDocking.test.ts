import {
  createDockingWrapper,
  showPanelDocked,
  hidePanelDocked,
  isMobileViewport,
  DOCKING_WRAPPER_TESTID,
  VIDEO_WRAPPER_TESTID,
} from '@/content/subtitleDocking';

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
    it('creates outer + video wrappers and moves video into video wrapper', () => {
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      expect(outerWrapper).toBeTruthy();
      expect(videoWrapper).toBeTruthy();
      expect(outerWrapper.getAttribute('data-testid')).toBe(DOCKING_WRAPPER_TESTID);
      expect(videoWrapper.getAttribute('data-testid')).toBe(VIDEO_WRAPPER_TESTID);
      expect(videoWrapper.contains(video)).toBe(true);
      expect(video.parentElement).toBe(videoWrapper);
      expect(outerWrapper.contains(videoWrapper)).toBe(true);
    });

    it('leaves outer wrapper as sibling of video\'s original parent content', () => {
      const container = video.parentElement;
      const { outerWrapper } = createDockingWrapper(video);
      expect(container?.firstChild).toBe(outerWrapper);
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
    it('sets outer wrapper flex row and video wrapper to 70% on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(outerWrapper.style.display).toBe('flex');
      expect(outerWrapper.style.flexDirection).toBe('row');
      expect(videoWrapper.style.flex).toBe('1 1 70%');
      expect(video.style.width).toBe('100%');
      expect(panel.style.display).toBe('flex');
      expect(panel.style.width).toBe('280px');
      expect(panel.style.position).toBe('relative');
      expect(panel.style.alignSelf).toBe('stretch');
    });

    it('sets outer wrapper flex column and splits video/panel 60/40 on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(outerWrapper.style.flexDirection).toBe('column');
      expect(videoWrapper.style.flex).toBe('0 0 60%');
      expect(videoWrapper.style.height).toBe('60%');
      expect(panel.style.flex).toBe('0 0 40%');
      expect(panel.style.height).toBe('40%');
      expect(panel.style.maxHeight).toBe('100%');
    });

    it('falls back to fixed positioning when video is absolutely positioned', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);
      video.style.position = 'absolute';
      mockVideoRect(video, { left: 100, top: 50, right: 400, bottom: 300, width: 300, height: 250 });

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(panel.style.position).toBe('fixed');
      expect(panel.style.left).toBe('400px');
      expect(panel.style.top).toBe('50px');
      expect(panel.style.width).toBe('280px');
      expect(panel.style.height).toBe('250px');
      expect(panel.getAttribute('data-docking-mode')).toBe('fixed');
    });

    it('places fixed panel on the left when right side overflows viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);
      video.style.position = 'absolute';
      mockVideoRect(video, { left: 300, top: 50, right: 450, bottom: 300, width: 150, height: 250 });

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(panel.style.position).toBe('fixed');
      expect(panel.style.left).toBe('20px'); // 300 - 280
      expect(panel.style.top).toBe('50px');
    });
  });

  describe('hidePanelDocked', () => {
    it('restores outer wrapper to block and hides panel', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);

      showPanelDocked(outerWrapper, videoWrapper, video, panel);
      hidePanelDocked(outerWrapper, videoWrapper, panel);

      expect(outerWrapper.style.display).toBe('block');
      expect(videoWrapper.style.flex).toBe('');
      expect(videoWrapper.style.width).toBe('100%');
      expect(video.style.width).toBe('100%');
      expect(panel.style.display).toBe('none');
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.right).toBe('0px');
    });
  });
});
