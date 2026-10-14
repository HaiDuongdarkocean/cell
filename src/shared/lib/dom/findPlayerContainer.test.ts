import {
  findLargestPlayableVideo,
  findPlayerContainer,
  findPlayerShell,
  findVideoOverlayContainer,
  videoOverlayMountNeedsMove,
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

  describe('findPlayerShell', () => {
    it('returns the video itself when there is no matching parent', () => {
      const video = createVideo(640, 360);
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      parent.appendChild(video);
      setBoundingClientRect(parent, 1000, 800); // much larger

      const result = findPlayerShell(video);
      expect(result).toBe(video);
    });

    it('keeps the nearest same-size ancestor through neutral wrappers', () => {
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

      const result = findPlayerShell(video);
      expect(result).toBe(player); // nearest player box, not farthest wrapper
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

      const result = findPlayerShell(video);
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

      const result = findPlayerShell(video);
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

      const result = findPlayerShell(video);
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

      const result = findPlayerShell(video);
      expect(result).toBe(sameSize);
    });

    it('picks the tight player box, not a same-size layout cell (kisskh)', () => {
      // kisskh: video 1103×913, .videoplayer 1103×922 (+1% control bar),
      // .col-12 grid cell shares the box, .row is page-wide. The shell must
      // stay on .videoplayer — col-12 loses col-xl-7 under 1200px and the
      // dock strip collapses to 0px.
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

      const result = findPlayerShell(video);
      expect(result).toBe(player); // nearest same-size, stops before row
    });

    it('skips display:inline ancestors — width:% does not apply to them', () => {
      // kisskh mat-video/app-watch are Angular custom elements (display:inline).
      // width% on an inline element is ignored — picking one leaves the dock
      // strip at 0px. The walk must traverse them and select .videoplayer.
      const video = createVideo(640, 360);
      const player = document.createElement('div');
      player.id = 'videoplayer';
      player.style.position = 'relative';
      const custom = document.createElement('mat-video');
      const col = document.createElement('div');
      col.id = 'col';
      const row = document.createElement('div');
      row.id = 'row';

      document.body.appendChild(row);
      row.appendChild(col);
      col.appendChild(custom);
      custom.appendChild(player);
      player.appendChild(video);

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(player, 640, 360);
      setBoundingClientRect(custom, 640, 360);
      setBoundingClientRect(col, 640, 360);
      setBoundingClientRect(row, 1200, 360);

      const result = findPlayerShell(video);
      expect(result).toBe(player);
    });

    it('a chrome pick is not overwritten by a later same-size neutral wrapper (kisskh)', () => {
      // Regression: .videoplayer owns chrome (positioned siblings) → picked.
      // .col-12 above it shares the box and must NOT steal the pick — the
      // grid cell collapses to full-width under Bootstrap breakpoints and
      // zeroes the dock strip.
      const video = createVideo(640, 360);
      const player = document.createElement('div');
      player.id = 'videoplayer';
      player.style.position = 'relative';
      const controls = document.createElement('div');
      controls.id = 'controls';
      controls.style.position = 'absolute';
      const col = document.createElement('div');
      col.id = 'col-12';
      const row = document.createElement('div');
      row.id = 'row';

      document.body.appendChild(row);
      row.appendChild(col);
      col.appendChild(player);
      player.appendChild(video);
      player.appendChild(controls); // positioned sibling ON the video

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(player, 640, 360);
      setBoundingClientRect(controls, 640, 80);
      setBoundingClientRect(col, 640, 360); // same box as player
      setBoundingClientRect(row, 640, 360); // even row stays same-size here

      const result = findPlayerShell(video);
      expect(result).toBe(player);
    });

    it('upgrades to a chrome-owning ancestor over the player box (m.youtube)', () => {
      // Host chrome as positioned siblings of the player subtree: the real
      // shell is the shared parent that owns them.
      const video = createVideo(640, 360);
      const player = document.createElement('div');
      player.id = 'player';
      const overlay = document.createElement('div');
      overlay.id = 'control-overlay';
      overlay.style.position = 'absolute';
      const shell = document.createElement('div');
      shell.id = 'shell';

      document.body.appendChild(shell);
      shell.appendChild(player);
      shell.appendChild(overlay);
      player.appendChild(video);

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(player, 640, 360);
      setBoundingClientRect(overlay, 640, 60); // control bar at bottom
      setBoundingClientRect(shell, 640, 360);

      const result = findPlayerShell(video);
      expect(result).toBe(shell);
    });

    it('rejects page-level scrims — a covering sibling bigger than the video is not player chrome', () => {
      // kisskh .mat-drawer-backdrop covers the whole page next to the video
      // column. The ancestor owning it (mat-sidenav-content) dwarfs the
      // player → not a shell upgrade.
      const video = createVideo(640, 360);
      const player = document.createElement('div');
      player.id = 'videoplayer';
      const column = document.createElement('div');
      const backdrop = document.createElement('div');
      backdrop.className = 'mat-drawer-backdrop';
      backdrop.style.position = 'absolute';
      const sidenav = document.createElement('div');

      document.body.appendChild(sidenav);
      sidenav.appendChild(column);
      sidenav.appendChild(backdrop);
      column.appendChild(player);
      player.appendChild(video);

      setBoundingClientRect(video, 640, 360);
      setBoundingClientRect(player, 640, 360);
      setBoundingClientRect(column, 640, 360);
      setBoundingClientRect(backdrop, 1200, 800); // full-page scrim
      setBoundingClientRect(sidenav, 1200, 800); // way over the 1.5x cap

      const result = findPlayerShell(video);
      expect(result).toBe(player);
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

  describe('videoOverlayMountNeedsMove', () => {
    function createShellDom(): { shell: HTMLElement; video: HTMLVideoElement } {
      const shell = document.createElement('div');
      shell.id = 'player-container-id';
      const player = document.createElement('div');
      player.id = 'player';
      const video = document.createElement('video');
      document.body.appendChild(shell);
      shell.appendChild(player);
      player.appendChild(video);
      setBoundingClientRect(video, 361, 203);
      setBoundingClientRect(player, 361, 203);
      setBoundingClientRect(shell, 361, 203);
      return { shell, video };
    }

    it('is true when the host still sits inside the video subtree while the pick resolves to the outer shell', () => {
      const { shell, video } = createShellDom();
      const host = document.createElement('div');
      video.parentElement!.appendChild(host);

      expect(videoOverlayMountNeedsMove(video, host, 'm.youtube.com')).toBe(true);
      shell.appendChild(host);
      expect(videoOverlayMountNeedsMove(video, host, 'm.youtube.com')).toBe(false);
    });

    it('is false when the host is inside a split-view surface or off YouTube', () => {
      const { video } = createShellDom();
      const host = document.createElement('div');
      video.parentElement!.appendChild(host);

      expect(videoOverlayMountNeedsMove(video, host, 'kisskh.do')).toBe(false);

      const stage = document.createElement('div');
      stage.setAttribute('data-tihoka-split-view', 'stage');
      stage.appendChild(host);
      document.body.appendChild(stage);
      expect(videoOverlayMountNeedsMove(video, host, 'm.youtube.com')).toBe(false);
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
