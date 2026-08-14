import {
  applyYoutubeSplitViewLayout,
  closeYoutubeSplitView,
  isYoutubePage,
  requestYoutubePlayerSize,
  resolveYoutubeSplitViewWrapperHeight,
  restoreYoutubePlayerSize,
} from './youtubeSplitView';

describe('youtubeSplitView', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('resolveYoutubeSplitViewWrapperHeight', () => {
    it('prefers the video height over the taller watch-page parent', () => {
      expect(resolveYoutubeSplitViewWrapperHeight(746, 1800)).toBe('746px');
    });
    it('falls back to the player height when video height is 0', () => {
      expect(resolveYoutubeSplitViewWrapperHeight(0, 746)).toBe('746px');
    });
  });

  describe('isYoutubePage', () => {
    it('matches youtube hosts only', () => {
      expect(isYoutubePage('www.youtube.com')).toBe(true);
      expect(isYoutubePage('m.youtube.com')).toBe(true);
      expect(isYoutubePage('youtu.be')).toBe(true);
      expect(isYoutubePage('kisskh.co')).toBe(false);
      expect(isYoutubePage('themoviebox.xyz')).toBe(false);
    });
  });

  describe('requestYoutubePlayerSize / restoreYoutubePlayerSize', () => {
    it('is a no-op off YouTube', () => {
      const spy = jest.spyOn(document, 'dispatchEvent');
      requestYoutubePlayerSize(640, 360, 'kisskh.co');
      restoreYoutubePlayerSize('kisskh.co');
      expect(spy).not.toHaveBeenCalled();
    });

    it('dispatches MAIN-world size events on YouTube', () => {
      const spy = jest.spyOn(document, 'dispatchEvent');
      requestYoutubePlayerSize(923.4, 745.6, 'www.youtube.com');
      expect(spy).toHaveBeenCalledWith(expect.any(CustomEvent));
      const setEvent = spy.mock.calls[0]?.[0] as CustomEvent;
      expect(setEvent.type).toBe('__YT_SET_SIZE');
      expect(setEvent.detail).toEqual({ width: 923, height: 746 });

      restoreYoutubePlayerSize('www.youtube.com');
      const restoreEvent = spy.mock.calls[1]?.[0] as CustomEvent;
      expect(restoreEvent.type).toBe('__YT_RESTORE_SIZE');
    });

    it('closeYoutubeSplitView dispatches RESTORE before CLOSE', () => {
      const spy = jest.spyOn(document, 'dispatchEvent');
      closeYoutubeSplitView('www.youtube.com');
      const types = spy.mock.calls.map((c) => (c[0] as CustomEvent).type);
      expect(types).toEqual(['__YT_RESTORE_SIZE', '__YT_SPLIT_CLOSE']);
    });
  });

  describe('applyYoutubeSplitViewLayout', () => {
    beforeEach(() => {
      // Double-rAF: flush both frames synchronously.
      let rafCount = 0;
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        rafCount++;
        cb(rafCount);
        return rafCount;
      });
    });

    it('measures the stage and dispatches setSize on YouTube', () => {
      const stage = document.createElement('div');
      document.body.appendChild(stage);
      jest.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
        width: 923,
        height: 746,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 923,
        bottom: 746,
        toJSON: () => ({}),
      } as DOMRect);
      const spy = jest.spyOn(document, 'dispatchEvent');

      const restore = applyYoutubeSplitViewLayout(stage, 'www.youtube.com');
      const setEvent = spy.mock.calls.find((call) => (call[0] as CustomEvent).type === '__YT_SET_SIZE')?.[0] as CustomEvent;
      expect(setEvent.detail).toEqual({ width: 923, height: 746 });

      restore();
      const restoreEvent = spy.mock.calls.find((call) => (call[0] as CustomEvent).type === '__YT_RESTORE_SIZE')?.[0] as CustomEvent;
      expect(restoreEvent).toBeDefined();
    });
  });
});
