import {
  findFarthestSameSizeContainer,
  findFlowSlotKeeper,
  findLargestPlayableVideo,
  findPlayerContainer,
  findVideoOverlayContainer,
} from './findPlayerContainer';

function setBoundingClientRect(el: HTMLElement, w: number, h: number): void {
  jest.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({
    x: 0,
    y: 0,
    width: w,
    height: h,
    top: 0,
    left: 0,
    right: w,
    bottom: h,
    toJSON: () => ({ x: 0, y: 0, width: w, height: h, top: 0, left: 0, right: w, bottom: h }),
  }));
}

function createVideo(videoWidth = 640, videoHeight = 360): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { value: videoWidth, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: videoHeight, configurable: true });
  Object.defineProperty(video, 'readyState', { value: 2, configurable: true });
  document.body.appendChild(video);
  setBoundingClientRect(video, videoWidth, videoHeight);
  return video;
}

describe('findPlayerContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('findFarthestSameSizeContainer', () => {
    it('returns the video itself when there is no matching parent', () => {
      const video = createVideo(640, 360);
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      parent.appendChild(video);
      setBoundingClientRect(parent, 1000, 800); // much larger

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(video);
    });

    it('walks up through same-size ancestors', () => {
      const video = createVideo(640, 360);
      const player = document.createElement('div');
      player.id = 'player';
      const wrapper = document.createElement('div');
      wrapper.id = 'wrapper';

      document.body.appendChild(wrapper);
      wrapper.appendChild(player);
      player.appendChild(video);

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(player, 640, 360);
      setBoundingClientRect(wrapper, 640, 360);

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(wrapper);
    });

    it('stops when an ancestor is much larger', () => {
      const video = createVideo(640, 360);
      const player = document.createElement('div');
      player.id = 'player';
      const page = document.createElement('div');
      page.id = 'page';

      document.body.appendChild(page);
      page.appendChild(player);
      player.appendChild(video);

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(player, 640, 360);
      setBoundingClientRect(page, 1200, 900);

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(player);
    });

    it('skips zero-area ancestors', () => {
      const video = createVideo(640, 360);
      const zero = document.createElement('div');
      const player = document.createElement('div');
      player.id = 'player';

      document.body.appendChild(player);
      player.appendChild(zero);
      zero.appendChild(video);

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(zero, 640, 0); // zero area
      setBoundingClientRect(player, 640, 360);

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(player);
    });

    it('rejects a container with same height but different width (themoviebox)', () => {
      // themoviebox: video 1226×690, .player-container 1635×690 (same height,
      // wider width) must NOT be accepted — both dimensions must match.
      const video = createVideo(1226, 690);
      const sameSize = document.createElement('div');
      sameSize.id = 'same-size';
      const wider = document.createElement('div');
      wider.id = 'wider';

      document.body.appendChild(wider);
      wider.appendChild(sameSize);
      sameSize.appendChild(video);

      setBoundingClientRect(video, 1226, 690);
      setBoundingClientRect(sameSize, 1226, 690);
      setBoundingClientRect(wider, 1635, 690); // same height, wider

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(sameSize);
    });

    it('rejects a container with same width but different height', () => {
      const video = createVideo(640, 360);
      const sameSize = document.createElement('div');
      sameSize.id = 'same-size';
      const taller = document.createElement('div');
      taller.id = 'taller';

      document.body.appendChild(taller);
      taller.appendChild(sameSize);
      sameSize.appendChild(video);

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(sameSize, 640, 360);
      setBoundingClientRect(taller, 640, 480); // same width, +33% height

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(sameSize);
    });

    it('accepts a container slightly taller because it owns the control bar (kisskh)', () => {
      // kisskh: video 1103×913, .videoplayer 1103×922 (same width, +1% height
      // for the control bar). Per-dimension tolerance accepts this so Split
      // View wraps the player WITH controls, not just the bare video.
      const video = createVideo(1103, 913);
      const player = document.createElement('div');
      player.id = 'videoplayer';
      const col = document.createElement('div');
      col.id = 'col';
      const row = document.createElement('div');
      row.id = 'row';

      document.body.appendChild(row);
      row.appendChild(col);
      col.appendChild(player);
      player.appendChild(video);

      setBoundingClientRect(video, 1103, 913);
      setBoundingClientRect(player, 1103, 922); // +9px control bar
      setBoundingClientRect(col, 1103, 922);
      setBoundingClientRect(row, 1891, 922); // much wider — layout container

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(col); // farthest within tolerance, stops before row
    });
  });

  describe('findLargestPlayableVideo', () => {
    it('returns null when no video is present', () => {
      expect(findLargestPlayableVideo()).toBeNull();
    });

    it('ignores videos with zero videoWidth', () => {
      const video = document.createElement('video');
      document.body.appendChild(video);
      expect(findLargestPlayableVideo()).toBeNull();
    });

    it('returns the largest playable video by intrinsic size', () => {
      const small = createVideo(320, 180);
      const large = createVideo(1280, 720);
      document.body.appendChild(small);
      document.body.appendChild(large);

      expect(findLargestPlayableVideo()).toBe(large);
    });

    it('includes videos with readyState 0 when they have non-zero rect', () => {
      const video = createVideo(640, 360);
      Object.defineProperty(video, 'readyState', { value: 0, configurable: true });

      expect(findLargestPlayableVideo()).toBe(video);
    });
  });

  describe('findVideoOverlayContainer', () => {
    function createMwebDom(shellW = 361, shellH = 203): { shell: HTMLElement; video: HTMLVideoElement } {
      const shell = document.createElement('div');
      shell.id = 'player-container-id';
      const player = document.createElement('div');
      player.id = 'player';
      const controls = document.createElement('div');
      controls.id = 'player-control-container';
      const video = document.createElement('video');

      document.body.appendChild(shell);
      shell.appendChild(player);
      player.appendChild(video);
      shell.appendChild(controls);

      setBoundingClientRect(video, 361, 203);
      setBoundingClientRect(player, 361, 203);
      setBoundingClientRect(shell, shellW, shellH);
      return { shell, video };
    }

    it('lifts to #player-container-id when the host control overlay is a sibling subtree (m.youtube)', () => {
      const { shell, video } = createMwebDom();
      expect(findVideoOverlayContainer(video)).toBe(shell);
    });

    it('falls back to the nearest sized ancestor when no #player-control-container exists', () => {
      const video = createVideo(640, 360);
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      parent.appendChild(video);
      setBoundingClientRect(parent, 640, 360);

      expect(findVideoOverlayContainer(video)).toBe(parent);
    });

    it('falls back when #player-container-id is not same-size as the video', () => {
      const { video } = createMwebDom(361, 600);
      const player = video.parentElement as HTMLElement;
      expect(findVideoOverlayContainer(video)).toBe(player);
    });

    it('prefers the tight inline wrapper over an oversized figure with figcaption (Wikipedia)', () => {
      const figure = document.createElement('figure');
      const caption = document.createElement('figcaption');
      const span = document.createElement('span');
      span.style.display = 'inline';
      const video = createVideo(250, 141);

      figure.appendChild(caption);
      figure.appendChild(span);
      span.appendChild(video);
      document.body.appendChild(figure);

      setBoundingClientRect(span, 250, 0); // inline wrapper reports ~0 height
      setBoundingClientRect(figure, 256, 273); // ~194% of video height

      expect(findVideoOverlayContainer(video)).toBe(span);
    });

    it('accepts an ancestor up to 160% of video height (player chrome padding)', () => {
      const video = createVideo(250, 141);
      const wrap = document.createElement('div');
      wrap.appendChild(video);
      document.body.appendChild(wrap);
      setBoundingClientRect(wrap, 256, 220); // ~156%

      expect(findVideoOverlayContainer(video)).toBe(wrap);
    });

    it('falls back to the first oversized ancestor when no tight wrapper exists', () => {
      const figure = document.createElement('figure');
      const video = createVideo(250, 141);
      figure.appendChild(video);
      document.body.appendChild(figure);
      setBoundingClientRect(figure, 256, 273);

      expect(findVideoOverlayContainer(video)).toBe(figure);
    });
  });

  describe('findPlayerContainer — overlay-sibling lift', () => {
    function createCoveredDom(coverPosition: 'absolute' | 'fixed' | 'static' = 'absolute'): {
      container: HTMLElement;
      player: HTMLElement;
      cover: HTMLElement;
      video: HTMLVideoElement;
    } {
      const container = document.createElement('div');
      container.id = 'player-container-id';
      const player = document.createElement('div');
      player.id = 'player';
      const cover = document.createElement('div');
      cover.className = 'player-controls-background';
      cover.style.position = coverPosition;
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 360, configurable: true });
      Object.defineProperty(video, 'readyState', { value: 2, configurable: true });

      document.body.appendChild(container);
      container.appendChild(player);
      player.appendChild(video);
      container.appendChild(cover);
      return { container, player, cover, video };
    }

    it('lifts to the shared parent when a positioned sibling covers the inner shell (m.youtube landscape)', () => {
      // Landscape: #player-container-id stretches wider than the video so the
      // same-size walk rejects it and returns #player — but YouTube's control
      // overlays are siblings of #player and would float over stage + panel.
      const { container, player, cover, video } = createCoveredDom();
      setBoundingClientRect(video, 452, 263);
      setBoundingClientRect(player, 452, 263);
      setBoundingClientRect(container, 652, 271);
      setBoundingClientRect(cover, 652, 271);

      expect(findPlayerContainer()).toBe(container);
    });

    it('keeps the inner shell when no positioned sibling covers it', () => {
      const { container, player, cover, video } = createCoveredDom('static');
      setBoundingClientRect(video, 452, 263);
      setBoundingClientRect(player, 452, 263);
      setBoundingClientRect(container, 652, 271);
      setBoundingClientRect(cover, 652, 271);

      expect(findPlayerContainer()).toBe(player);
    });

    it('refuses to lift into a page-column parent larger than the viewport', () => {
      const { container, player, cover, video } = createCoveredDom();
      setBoundingClientRect(video, 452, 263);
      setBoundingClientRect(player, 452, 263);
      setBoundingClientRect(container, 652, 2000); // taller than 120% of viewport
      setBoundingClientRect(cover, 652, 2000);

      expect(findPlayerContainer()).toBe(player);
    });
  });

  describe('findFlowSlotKeeper', () => {
    function mockHits(hits: Element[]): void {
      Object.defineProperty(document, 'elementsFromPoint', {
        value: () => hits,
        configurable: true,
      });
    }

    it('returns the same-size in-flow element below the shell (m.youtube player-placeholder)', () => {
      const shell = document.createElement('div');
      shell.id = 'player-container-id';
      shell.style.position = 'absolute';
      const placeholder = document.createElement('div');
      placeholder.className = 'player-placeholder';
      placeholder.style.position = 'relative';
      document.body.appendChild(placeholder);
      document.body.appendChild(shell);
      setBoundingClientRect(shell, 667, 279);
      setBoundingClientRect(placeholder, 667, 279);
      mockHits([shell, placeholder, document.body, document.documentElement]);

      expect(findFlowSlotKeeper(shell)).toBe(placeholder);
    });

    it('returns null when nothing below the shell is same-size in-flow', () => {
      const shell = document.createElement('div');
      shell.style.position = 'absolute';
      document.body.appendChild(shell);
      setBoundingClientRect(shell, 667, 279);
      mockHits([shell, document.body, document.documentElement]);

      expect(findFlowSlotKeeper(shell)).toBeNull();
    });

    it('skips shell descendants, shell ancestors, and positioned elements', () => {
      const shell = document.createElement('div');
      shell.style.position = 'absolute';
      const inside = document.createElement('div');
      inside.style.position = 'relative';
      const cover = document.createElement('div');
      cover.style.position = 'fixed';
      const ancestor = document.createElement('div');
      ancestor.style.position = 'relative';
      const keeper = document.createElement('div');

      document.body.appendChild(ancestor);
      ancestor.appendChild(keeper);
      document.body.appendChild(shell);
      shell.appendChild(inside);
      document.body.appendChild(cover);

      setBoundingClientRect(shell, 667, 279);
      setBoundingClientRect(inside, 667, 279);
      setBoundingClientRect(cover, 667, 279);
      setBoundingClientRect(ancestor, 667, 279);
      setBoundingClientRect(keeper, 667, 279);
      mockHits([inside, shell, cover, keeper, ancestor, document.body]);

      expect(findFlowSlotKeeper(shell)).toBe(keeper);
    });

    it('rejects an in-flow element that only matches one dimension', () => {
      const shell = document.createElement('div');
      shell.style.position = 'absolute';
      const column = document.createElement('div');
      document.body.appendChild(column);
      document.body.appendChild(shell);
      setBoundingClientRect(shell, 667, 279);
      setBoundingClientRect(column, 667, 2000);
      mockHits([shell, column, document.body]);

      expect(findFlowSlotKeeper(shell)).toBeNull();
    });
  });

  describe('findPlayerContainer', () => {
    it('returns the player container for a direct video', () => {
      const video = createVideo(640, 360);
      const player = document.createElement('div');
      document.body.appendChild(player);
      player.appendChild(video);
      setBoundingClientRect(player, 640, 360);

      const result = findPlayerContainer();
      expect(result).toBe(player);
    });

    it('returns null when no playable video exists', () => {
      expect(findPlayerContainer()).toBeNull();
    });
  });
});
