import {
  findFarthestSameSizeContainer,
  findLargestPlayableVideo,
  findPlayerContainer,
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
      setBoundingClientRect(taller, 640, 480); // same width, taller

      const result = findFarthestSameSizeContainer(video);
      expect(result).toBe(sameSize);
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
