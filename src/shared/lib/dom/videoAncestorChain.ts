// Elements between a player container and its <video> that must be sized
// together with the container — the video's ancestor wrappers, in any sibling
// position. Walking firstElementChild instead breaks on hosts whose real
// player subtree is not the first child (m.youtube: #player-container-id's
// firstElementChild is #player-thumbnail-overlay; the video lives under the
// 3rd child #player), leaving .html5-video-container at height:0.
// Falls back to the firstElementChild chain when no <video> exists
// (canvas/non-video players). O(d), d = chain depth.

export function videoAncestorChain(player: HTMLElement): HTMLElement[] {
  const video = player.querySelector('video');
  const chain: HTMLElement[] = [];
  if (video) {
    for (let el = video.parentElement; el && el !== player; el = el.parentElement) {
      chain.push(el);
    }
    return chain;
  }
  for (let el = player.firstElementChild as HTMLElement | null; el; el = el.firstElementChild as HTMLElement | null) {
    chain.push(el);
  }
  return chain;
}
