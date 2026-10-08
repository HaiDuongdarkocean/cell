import { videoAncestorChain } from './videoAncestorChain';

describe('videoAncestorChain', () => {
  it('walks video ancestors not on the firstElementChild path (m.youtube structure)', () => {
    const player = document.createElement('div');
    player.innerHTML = `
      <img id="thumb">
      <div id="cinematics"></div>
      <div id="player">
        <div id="movie_player">
          <div class="html5-video-container"><video></video></div>
        </div>
      </div>`;
    const chain = videoAncestorChain(player);
    expect(chain.map((e) => e.id || e.className)).toEqual([
      'html5-video-container',
      'movie_player',
      'player',
    ]);
  });

  it('returns empty chain when video is a direct child', () => {
    const player = document.createElement('div');
    player.innerHTML = '<video></video>';
    expect(videoAncestorChain(player)).toEqual([]);
  });

  it('falls back to firstElementChild chain when no video exists', () => {
    const player = document.createElement('div');
    player.innerHTML = '<div id="a"><div id="b"><canvas></canvas></div></div><div id="sibling"></div>';
    expect(videoAncestorChain(player).map((e) => e.id || e.tagName)).toEqual(['a', 'b', 'CANVAS']);
  });
});
