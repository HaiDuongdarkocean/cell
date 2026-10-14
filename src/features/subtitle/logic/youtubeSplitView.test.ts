import {
  applyYoutubeSplitViewCss,
  isYoutubePage,
  removeYoutubeSplitViewCss,
} from './youtubeSplitView';

describe('youtubeSplitView', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
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

  describe('applyYoutubeSplitViewCss / removeYoutubeSplitViewCss', () => {
    it('dispatches bridge events on YouTube only', () => {
      const spy = jest.spyOn(document, 'dispatchEvent');
      applyYoutubeSplitViewCss('www.youtube.com');
      removeYoutubeSplitViewCss('www.youtube.com');
      const types = spy.mock.calls.map((c) => (c[0] as CustomEvent).type);
      expect(types).toEqual(['__YT_SPLIT_VIEW_APPLY_CSS', '__YT_SPLIT_VIEW_REMOVE_CSS']);
    });

    it('is a no-op off YouTube', () => {
      const spy = jest.spyOn(document, 'dispatchEvent');
      applyYoutubeSplitViewCss('kisskh.co');
      removeYoutubeSplitViewCss('kisskh.co');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
