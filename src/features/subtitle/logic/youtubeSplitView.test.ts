import {
  applyYoutubeSplitViewCss,
  isYoutubePage,
  removeYoutubeSplitViewCss,
  youtubeFollowsParentSlot,
  youtubeSplitViewLiveHeight,
  youtubeSplitViewOwnsFill,
  youtubeSplitViewWrapperCss,
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

  describe('youtubeSplitViewOwnsFill', () => {
    it('gates on the hostname', () => {
      expect(youtubeSplitViewOwnsFill('www.youtube.com')).toBe(true);
      expect(youtubeSplitViewOwnsFill('kisskh.co')).toBe(false);
    });
  });

  describe('youtubeFollowsParentSlot', () => {
    it('returns false off YouTube', () => {
      const parent = document.createElement('div');
      parent.style.height = '200px';
      expect(youtubeFollowsParentSlot(parent, 180, 'kisskh.co')).toBe(false);
    });

    it('returns true when the parent hands a definite player-height slot', () => {
      const parent = document.createElement('div');
      parent.style.height = '200px';
      document.body.appendChild(parent);
      jest.spyOn(parent, 'getBoundingClientRect').mockReturnValue({
        width: 360, height: 200, x: 0, y: 0, top: 0, left: 0, right: 360, bottom: 200,
        toJSON: () => ({}),
      } as DOMRect);
      expect(youtubeFollowsParentSlot(parent, 200, 'm.youtube.com')).toBe(true);
    });

    it('returns false for padding-driven parents (computed height 0)', () => {
      const parent = document.createElement('div');
      parent.style.height = '0px';
      expect(youtubeFollowsParentSlot(parent, 200, 'm.youtube.com')).toBe(false);
    });
  });

  describe('youtubeSplitViewWrapperCss', () => {
    it('pins height with !important and a fixed flex footprint', () => {
      const css = youtubeSplitViewWrapperCss('211px', 'position:fixed;top:48px;');
      expect(css).toContain('height:211px!important');
      expect(css).toContain('flex:0 0 auto');
      expect(css).toContain('position:fixed;top:48px;');
    });
  });

  describe('youtubeSplitViewLiveHeight', () => {
    it('keeps the page-reserved slot height for out-of-flow shells (AC-4.9)', () => {
      const h = youtubeSplitViewLiveHeight({
        shellOutOfFlow: true,
        stageWidth: 452,
        videoAspect: 16 / 9,
        followsParent: false,
        fallbackHeight: '211px',
        measureSlotHeight: () => 271,
        clampVisiblePx: (px) => px,
      });
      expect(h).toBe('271px');
    });

    it('re-derives fixed-shell height from the live stage width and aspect', () => {
      const h = youtubeSplitViewLiveHeight({
        shellOutOfFlow: true,
        stageWidth: 452,
        videoAspect: 16 / 9,
        followsParent: false,
        fallbackHeight: '211px',
        clampVisiblePx: (px) => px,
      });
      expect(h).toBe('254px');
    });

    it('returns 100% when the parent slot is followable', () => {
      const h = youtubeSplitViewLiveHeight({
        shellOutOfFlow: false,
        stageWidth: 452,
        videoAspect: 16 / 9,
        followsParent: true,
        fallbackHeight: '211px',
        clampVisiblePx: (px) => px,
      });
      expect(h).toBe('100%');
    });

    it('falls back to the open-time height otherwise', () => {
      const h = youtubeSplitViewLiveHeight({
        shellOutOfFlow: false,
        stageWidth: 452,
        videoAspect: 16 / 9,
        followsParent: false,
        fallbackHeight: '211px',
        clampVisiblePx: (px) => px,
      });
      expect(h).toBe('211px');
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
