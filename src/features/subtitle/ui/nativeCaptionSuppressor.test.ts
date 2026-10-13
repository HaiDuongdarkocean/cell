import { suppressNativeCaptions } from './nativeCaptionSuppressor';

const makeTrackList = (tracks: TextTrack[]): TextTrackList => {
  const list = tracks as unknown as TextTrackList;
  const listeners = new Set<EventListener>();
  Object.assign(list, {
    addEventListener: (_t: string, fn: EventListener) => listeners.add(fn),
    removeEventListener: (_t: string, fn: EventListener) => listeners.delete(fn),
    dispatchAddtrack: () => listeners.forEach((fn) => fn(new Event('addtrack'))),
  });
  return list;
};

describe('suppressNativeCaptions', () => {
  it('injects the caption-hide style and removes it on cleanup', () => {
    const video = document.createElement('video');
    const restore = suppressNativeCaptions(document, video);
    const style = document.getElementById('Tihoka-native-caption-hide');
    expect(style?.textContent).toContain('.ytp-caption-window-container');
    restore();
    expect(document.getElementById('Tihoka-native-caption-hide')).toBeNull();
  });

  it('hides showing text tracks and restores their mode on cleanup', () => {
    const showing = { mode: 'showing' } as TextTrack;
    const hidden = { mode: 'hidden' } as TextTrack;
    const video = { textTracks: makeTrackList([showing, hidden]) } as unknown as HTMLVideoElement;

    const restore = suppressNativeCaptions(document, video);
    expect(showing.mode).toBe('hidden');
    expect(hidden.mode).toBe('hidden');

    restore();
    expect(showing.mode).toBe('showing');
    expect(hidden.mode).toBe('hidden');
  });

  it('hides tracks added after mount via addtrack', () => {
    const late = { mode: 'showing' } as TextTrack;
    const list = makeTrackList([late]) as TextTrackList & { dispatchAddtrack: () => void };
    const video = { textTracks: list } as unknown as HTMLVideoElement;

    const restore = suppressNativeCaptions(document, video);
    list.dispatchAddtrack();
    expect(late.mode).toBe('hidden');
    restore();
  });
});
