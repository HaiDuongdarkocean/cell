import {
  createDockingWrapper,
  showPanelDocked,
  hidePanelDocked,
  isMobileViewport,
  DOCKING_WRAPPER_TESTID,
  VIDEO_WRAPPER_TESTID,
  DESKTOP_VIDEO_RATIO,
  DESKTOP_PANEL_RATIO,
  MOBILE_VIDEO_RATIO,
  MOBILE_PANEL_RATIO,
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

    it('anchors outer wrapper to F0 when parent chain matches video width', () => {
      const container = video.parentElement;
      const f0 = document.createElement('div');
      f0.setAttribute('data-testid', 'f0-container');
      // F0 is the farthest ancestor whose rendered width matches the video.
      expect(container).not.toBeNull();
      f0.style.width = '800px';
      f0.appendChild(container as HTMLElement);
      document.body.appendChild(f0);
      const videoRect = { width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450, x: 0, y: 0, toJSON: () => {} };
      const containerRect = { width: 800, height: 500, left: 0, top: 0, right: 800, bottom: 500, x: 0, y: 0, toJSON: () => {} };
      jest.spyOn(video, 'getBoundingClientRect').mockReturnValue(videoRect as DOMRect);
      jest.spyOn(container as HTMLElement, 'getBoundingClientRect').mockReturnValue(containerRect as DOMRect);
      jest.spyOn(f0, 'getBoundingClientRect').mockReturnValue(videoRect as DOMRect);

      const { outerWrapper } = createDockingWrapper(video);
      expect(outerWrapper.parentElement).toBe(f0);
    });

    it('chooses the farthest width-matching ancestor as F0', () => {
      const container = video.parentElement;
      const middle = document.createElement('div');
      middle.setAttribute('data-testid', 'middle-ancestor');
      const f0 = document.createElement('div');
      f0.setAttribute('data-testid', 'f0-container');
      expect(container).not.toBeNull();
      middle.style.width = '800px';
      f0.style.width = '800px';
      middle.appendChild(container as HTMLElement);
      f0.appendChild(middle);
      document.body.appendChild(f0);
      const videoRect = { width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450, x: 0, y: 0, toJSON: () => {} };
      const containerRect = { width: 800, height: 500, left: 0, top: 0, right: 800, bottom: 500, x: 0, y: 0, toJSON: () => {} };
      const middleRect = { width: 800, height: 550, left: 0, top: 0, right: 800, bottom: 550, x: 0, y: 0, toJSON: () => {} };
      jest.spyOn(video, 'getBoundingClientRect').mockReturnValue(videoRect as DOMRect);
      jest.spyOn(container as HTMLElement, 'getBoundingClientRect').mockReturnValue(containerRect as DOMRect);
      jest.spyOn(middle, 'getBoundingClientRect').mockReturnValue(middleRect as DOMRect);
      jest.spyOn(f0, 'getBoundingClientRect').mockReturnValue(videoRect as DOMRect);

      const { outerWrapper } = createDockingWrapper(video);
      expect(outerWrapper.parentElement).toBe(f0);
    });

    it('falls back to video parent when no matching F0 ancestor', () => {
      const container = video.parentElement;
      Object.defineProperty(video, 'getBoundingClientRect', {
        value: () => ({ width: 300, height: 200, left: 0, top: 0, right: 300, bottom: 200, x: 0, y: 0, toJSON: () => {} }),
        configurable: true,
      });
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({ width: 500, height: 200, left: 0, top: 0, right: 500, bottom: 200, x: 0, y: 0, toJSON: () => {} }),
        configurable: true,
      });

      const { outerWrapper } = createDockingWrapper(video);
      expect(outerWrapper.parentElement).toBe(container);
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
    it('splits video wrapper 70% and panel 30% on desktop flex layout', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(outerWrapper.style.display).toBe('flex');
      expect(outerWrapper.style.flexDirection).toBe('row');
      expect(videoWrapper.style.flex).toBe(`0 0 ${DESKTOP_VIDEO_RATIO}`);
      expect(videoWrapper.style.height).toBe('100%');
      expect(video.style.width).toBe('100%');
      expect(panel.style.flex).toBe(`0 0 ${DESKTOP_PANEL_RATIO}`);
      expect(panel.style.display).toBe('flex');
      expect(panel.style.position).toBe('relative');
      expect(panel.style.alignSelf).toBe('stretch');
      expect(panel.getAttribute('data-docking-mode')).toBe('flex');
    });

    it('stacks video wrapper 60% and panel 40% on mobile flex layout', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(outerWrapper.style.flexDirection).toBe('column');
      expect(videoWrapper.style.width).toBe('100%');
      expect(videoWrapper.style.height).toBe(MOBILE_VIDEO_RATIO);
      expect(video.style.height).toBe('100%');
      expect(panel.style.width).toBe('100%');
      expect(panel.style.height).toBe(MOBILE_PANEL_RATIO);
      expect(panel.getAttribute('data-docking-mode')).toBe('flex');
    });

    it('uses absolute-docked 70/30 layout when video is out-of-flow', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);
      video.style.position = 'absolute';
      mockVideoRect(video, { left: 100, top: 50, right: 400, bottom: 300, width: 300, height: 250 });

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(outerWrapper.style.position).toBe('absolute');
      expect(videoWrapper.style.position).toBe('absolute');
      expect(videoWrapper.style.width).toBe(DESKTOP_VIDEO_RATIO);
      expect(videoWrapper.style.height).toBe('100%');
      expect(video.style.getPropertyValue('width')).toBe('auto');
      expect(video.style.getPropertyValue('height')).toBe('auto');
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.left).toBe(DESKTOP_VIDEO_RATIO);
      expect(panel.style.width).toBe(DESKTOP_PANEL_RATIO);
      expect(panel.style.height).toBe('100%');
      expect(panel.getAttribute('data-docking-mode')).toBe('absolute-docked');
    });

    it('stacks out-of-flow video and panel 60/40 vertically on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      const { outerWrapper, videoWrapper } = createDockingWrapper(video);
      outerWrapper.appendChild(panel);
      outerWrapper.appendChild(toggle);
      video.style.position = 'absolute';
      mockVideoRect(video, { left: 100, top: 50, right: 400, bottom: 300, width: 300, height: 250 });

      showPanelDocked(outerWrapper, videoWrapper, video, panel);

      expect(outerWrapper.style.flexDirection).toBe('column');
      expect(videoWrapper.style.position).toBe('absolute');
      expect(videoWrapper.style.width).toBe('100%');
      expect(videoWrapper.style.height).toBe(MOBILE_VIDEO_RATIO);
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.width).toBe('100%');
      expect(panel.style.height).toBe(MOBILE_PANEL_RATIO);
      expect(panel.style.left).toMatch(/^0(p?x)?$/);
      expect(panel.getAttribute('data-docking-mode')).toBe('absolute-docked');
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
      expect(outerWrapper.style.position).toBe('static');
      expect(videoWrapper.style.flex).toBe('');
      expect(videoWrapper.style.width).toBe('100%');
      expect(video.style.getPropertyValue('width')).toBe('');
      expect(video.style.getPropertyValue('position')).toBe('');
      expect(panel.style.display).toBe('none');
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.right).toBe('0px');
    });
  });
});
