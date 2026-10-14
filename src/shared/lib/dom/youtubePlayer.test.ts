import { isYoutubePage, pickYoutubeOverlayMount, pickYoutubePlayerShell } from './youtubePlayer';

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
    toJSON: () => ({}),
  }));
}

describe('youtubePlayer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('isYoutubePage', () => {
    it('matches youtube hosts', () => {
      expect(isYoutubePage('www.youtube.com')).toBe(true);
      expect(isYoutubePage('m.youtube.com')).toBe(true);
      expect(isYoutubePage('youtu.be')).toBe(true);
      expect(isYoutubePage('kisskh.co')).toBe(false);
    });
  });

  describe('pickYoutubePlayerShell', () => {
    it('returns #movie_player when its parent has a real content height (desktop)', () => {
      const player = document.createElement('div');
      player.id = 'player';
      player.style.height = '360px';
      const moviePlayer = document.createElement('div');
      moviePlayer.id = 'movie_player';
      const video = document.createElement('video');

      document.body.appendChild(player);
      player.appendChild(moviePlayer);
      moviePlayer.appendChild(video);

      expect(pickYoutubePlayerShell(video)).toBe(moviePlayer);
    });

    it('returns null when movie_player sits in a padding-driven shell (m.youtube .player-size)', () => {
      const player = document.createElement('div');
      player.id = 'player';
      player.style.height = '0px';
      const moviePlayer = document.createElement('div');
      moviePlayer.id = 'movie_player';
      const video = document.createElement('video');

      document.body.appendChild(player);
      player.appendChild(moviePlayer);
      moviePlayer.appendChild(video);

      expect(pickYoutubePlayerShell(video)).toBeNull();
    });

    it('returns null when the video is not inside #movie_player', () => {
      const moviePlayer = document.createElement('div');
      moviePlayer.id = 'movie_player';
      const video = document.createElement('video');
      document.body.appendChild(moviePlayer);
      document.body.appendChild(video);

      expect(pickYoutubePlayerShell(video)).toBeNull();
    });
  });

  describe('pickYoutubeOverlayMount', () => {
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

    it('returns #player-container-id when it is same-size as the video', () => {
      const { shell, video } = createMwebDom();
      expect(pickYoutubeOverlayMount(video)).toBe(shell);
    });

    it('returns null when #player-container-id diverges from the video box', () => {
      const { video } = createMwebDom(361, 600);
      expect(pickYoutubeOverlayMount(video)).toBeNull();
    });

    it('still returns the shell before the controls subtree mounts (late controls lose to the root z-index anyway)', () => {
      const { shell, video } = createMwebDom();
      document.getElementById('player-control-container')?.remove();
      expect(pickYoutubeOverlayMount(video)).toBe(shell);
    });
  });
});
