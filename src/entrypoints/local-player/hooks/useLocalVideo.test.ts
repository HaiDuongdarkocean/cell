import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useLocalVideo } from './useLocalVideo';

/**
 * Minimal mock video element — implements the subset of HTMLVideoElement
 * properties + methods that useLocalVideo reads/writes.  We attach real
 * EventTarget behaviour so listeners can be dispatched in tests.
 */
function createMockVideoElement(): HTMLVideoElement {
  const el = document.createElement('video');
  // jsdom's HTMLMediaElement has no real playback; seed sane defaults.
  Object.defineProperties(el, {
    currentTime: { value: 0, writable: true, configurable: true },
    duration: { value: 0, writable: true, configurable: true },
    volume: { value: 1, writable: true, configurable: true },
    muted: { value: false, writable: true, configurable: true },
    playbackRate: { value: 1, writable: true, configurable: true },
    paused: { value: true, writable: true, configurable: true },
  });
  // Mock play/pause to flip the `paused` flag so keyboard toggle logic works.
  el.play = jest.fn(() => {
    Object.defineProperty(el, 'paused', { value: false, configurable: true });
    return Promise.resolve();
  });
  el.pause = jest.fn(() => {
    Object.defineProperty(el, 'paused', { value: true, configurable: true });
  });
  el.requestFullscreen = jest.fn(() => Promise.resolve());
  (el as unknown as { requestPictureInPicture: jest.Mock }).requestPictureInPicture = jest.fn(() =>
    Promise.resolve(),
  );
  return el;
}

/** jsdom doesn't implement requestFullscreen on arbitrary elements. */
function createMockContainer(): HTMLDivElement {
  const div = document.createElement('div');
  (div as unknown as { requestFullscreen: jest.Mock }).requestFullscreen = jest.fn(() =>
    Promise.resolve(),
  );
  return div;
}

/**
 * Helper: render useLocalVideo with a fresh mock video element + container.
 * Returns the hook result plus the refs so tests can drive the DOM.
 */
function renderWithRefs() {
  const videoRef = { current: createMockVideoElement() };
  const containerRef = { current: createMockContainer() };

  const { result } = renderHook(() => {
    const v = useRef<HTMLVideoElement>(videoRef.current);
    const c = useRef<HTMLDivElement>(containerRef.current);
    return useLocalVideo(v, c);
  });

  return { result, videoRef, containerRef };
}

describe('useLocalVideo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('exposes default playback state', () => {
      const { result } = renderWithRefs();
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentTime).toBe(0);
      expect(result.current.duration).toBe(0);
      expect(result.current.volume).toBe(1);
      expect(result.current.muted).toBe(false);
      expect(result.current.playbackRate).toBe(1);
    });
  });

  describe('play / pause', () => {
    it('play() sets isPlaying=true and calls video.play()', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.play());
      expect(result.current.isPlaying).toBe(true);
      expect(videoRef.current.play).toHaveBeenCalledTimes(1);
    });

    it('pause() sets isPlaying=false and calls video.pause()', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.play());
      act(() => result.current.pause());
      expect(result.current.isPlaying).toBe(false);
      expect(videoRef.current.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('seek', () => {
    it('seek(30) sets currentTime on video + state', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.seek(30));
      expect(videoRef.current.currentTime).toBe(30);
      expect(result.current.currentTime).toBe(30);
    });
  });

  describe('volume', () => {
    it('setVolume(0.5) sets volume on video + state', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.setVolume(0.5));
      expect(videoRef.current.volume).toBe(0.5);
      expect(result.current.volume).toBe(0.5);
    });

    it('setVolume clamps to [0,1]', () => {
      const { result } = renderWithRefs();
      act(() => result.current.setVolume(2));
      expect(result.current.volume).toBe(1);
      act(() => result.current.setVolume(-1));
      expect(result.current.volume).toBe(0);
    });
  });

  describe('playbackRate', () => {
    it('setPlaybackRate(1.5) sets playbackRate on video + state', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.setPlaybackRate(1.5));
      expect(videoRef.current.playbackRate).toBe(1.5);
      expect(result.current.playbackRate).toBe(1.5);
    });
  });

  describe('mute', () => {
    it('toggleMute() toggles muted on video + state', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.toggleMute());
      expect(videoRef.current.muted).toBe(true);
      expect(result.current.muted).toBe(true);
      act(() => result.current.toggleMute());
      expect(videoRef.current.muted).toBe(false);
      expect(result.current.muted).toBe(false);
    });
  });

  describe('fullscreen', () => {
    it('toggleFullscreen() calls requestFullscreen on container', () => {
      const { result, containerRef } = renderWithRefs();
      act(() => result.current.toggleFullscreen());
      expect(containerRef.current.requestFullscreen).toHaveBeenCalledTimes(1);
    });
  });

  describe('picture-in-picture', () => {
    it('togglePiP() calls requestPictureInPicture on video', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.togglePiP());
      expect(
        (videoRef.current as unknown as { requestPictureInPicture: jest.Mock })
          .requestPictureInPicture,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('media events', () => {
    it('loadedmetadata updates duration', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => {
        Object.defineProperty(videoRef.current, 'duration', { value: 120, configurable: true });
        videoRef.current.dispatchEvent(new Event('loadedmetadata'));
      });
      expect(result.current.duration).toBe(120);
    });

    it('play event sets isPlaying=true', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => {
        Object.defineProperty(videoRef.current, 'paused', { value: false, configurable: true });
        videoRef.current.dispatchEvent(new Event('play'));
      });
      expect(result.current.isPlaying).toBe(true);
    });

    it('pause event sets isPlaying=false', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => result.current.play());
      act(() => {
        Object.defineProperty(videoRef.current, 'paused', { value: true, configurable: true });
        videoRef.current.dispatchEvent(new Event('pause'));
      });
      expect(result.current.isPlaying).toBe(false);
    });

    it('volumechange syncs volume + muted', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => {
        Object.defineProperty(videoRef.current, 'volume', { value: 0.3, configurable: true });
        Object.defineProperty(videoRef.current, 'muted', { value: true, configurable: true });
        videoRef.current.dispatchEvent(new Event('volumechange'));
      });
      expect(result.current.volume).toBe(0.3);
      expect(result.current.muted).toBe(true);
    });

    it('ratechange syncs playbackRate', () => {
      const { result, videoRef } = renderWithRefs();
      act(() => {
        Object.defineProperty(videoRef.current, 'playbackRate', { value: 2, configurable: true });
        videoRef.current.dispatchEvent(new Event('ratechange'));
      });
      expect(result.current.playbackRate).toBe(2);
    });

    it('timeupdate is throttled to 250ms', () => {
      const onTimeUpdate = jest.fn();
      const videoRef = { current: createMockVideoElement() };
      const containerRef = { current: createMockContainer() };
      const { result } = renderHook(() => {
        const v = useRef<HTMLVideoElement>(videoRef.current);
        const c = useRef<HTMLDivElement>(containerRef.current);
        return useLocalVideo(v, c, { onTimeUpdate });
      });

      // Fire 5 timeupdate events at 200ms intervals — 250ms throttle.
      // t=0: fires (first). t=200: throttled. t=400: fires. t=600: throttled. t=800: fires.
      act(() => {
        for (let i = 1; i <= 5; i++) {
          Object.defineProperty(videoRef.current, 'currentTime', {
            value: i,
            configurable: true,
          });
          videoRef.current.dispatchEvent(new Event('timeupdate'));
          jest.advanceTimersByTime(200);
        }
      });
      // 3 fires: at t=0 (currentTime=1), t=400 (currentTime=3), t=800 (currentTime=5).
      expect(onTimeUpdate).toHaveBeenCalledTimes(3);
      expect(result.current.currentTime).toBe(5);

      // Advance past the next 250ms throttle boundary + fire again.
      act(() => {
        jest.advanceTimersByTime(300);
        Object.defineProperty(videoRef.current, 'currentTime', {
          value: 10,
          configurable: true,
        });
        videoRef.current.dispatchEvent(new Event('timeupdate'));
      });
      expect(onTimeUpdate).toHaveBeenCalledTimes(4);
      expect(onTimeUpdate).toHaveBeenLastCalledWith(10);
      expect(result.current.currentTime).toBe(10);
    });
  });

  describe('keyboard shortcuts', () => {
    // Shortcuts now listen on window (bubble phase) so they fire regardless
    // of focus — the <video> is not focusable by default. Dispatch on window
    // to match real behavior (focus on document.body → keydown reaches window).
    function fireKey(_container: HTMLDivElement, key: string, shift = false): void {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          shiftKey: shift,
          bubbles: true,
          cancelable: true,
        }),
      );
    }

    it('space toggles play', () => {
      const { result, containerRef } = renderWithRefs();
      act(() => fireKey(containerRef.current, ' '));
      expect(result.current.isPlaying).toBe(true);
      act(() => fireKey(containerRef.current, ' '));
      expect(result.current.isPlaying).toBe(false);
    });

    it('ArrowLeft seeks -5s', () => {
      const { result, videoRef, containerRef } = renderWithRefs();
      act(() => result.current.seek(100));
      act(() => fireKey(containerRef.current, 'ArrowLeft'));
      expect(videoRef.current.currentTime).toBe(95);
      expect(result.current.currentTime).toBe(95);
    });

    it('ArrowRight seeks +5s', () => {
      const { result, videoRef, containerRef } = renderWithRefs();
      act(() => result.current.seek(100));
      act(() => fireKey(containerRef.current, 'ArrowRight'));
      expect(videoRef.current.currentTime).toBe(105);
      expect(result.current.currentTime).toBe(105);
    });

    it('Shift+ArrowLeft seeks -10s', () => {
      const { result, videoRef, containerRef } = renderWithRefs();
      act(() => result.current.seek(100));
      act(() => fireKey(containerRef.current, 'ArrowLeft', true));
      expect(videoRef.current.currentTime).toBe(90);
      expect(result.current.currentTime).toBe(90);
    });

    it('Shift+ArrowRight seeks +10s', () => {
      const { result, videoRef, containerRef } = renderWithRefs();
      act(() => result.current.seek(100));
      act(() => fireKey(containerRef.current, 'ArrowRight', true));
      expect(videoRef.current.currentTime).toBe(110);
      expect(result.current.currentTime).toBe(110);
    });

    it('m toggles mute', () => {
      const { result, containerRef } = renderWithRefs();
      act(() => fireKey(containerRef.current, 'm'));
      expect(result.current.muted).toBe(true);
      act(() => fireKey(containerRef.current, 'm'));
      expect(result.current.muted).toBe(false);
    });

    it('f toggles fullscreen', () => {
      const { containerRef } = renderWithRefs();
      act(() => fireKey(containerRef.current, 'f'));
      expect(containerRef.current.requestFullscreen).toHaveBeenCalledTimes(1);
    });
  });

  describe('autoPlay', () => {
    it('calls video.play() on loadedmetadata when autoPlay=true', () => {
      const videoRef = { current: createMockVideoElement() };
      const containerRef = { current: createMockContainer() };
      renderHook(() => {
        const v = useRef<HTMLVideoElement>(videoRef.current);
        const c = useRef<HTMLDivElement>(containerRef.current);
        return useLocalVideo(v, c, { autoPlay: true });
      });
      act(() => {
        Object.defineProperty(videoRef.current, 'duration', { value: 120, configurable: true });
        videoRef.current.dispatchEvent(new Event('loadedmetadata'));
      });
      expect(videoRef.current.play).toHaveBeenCalledTimes(1);
    });

    it('does NOT call video.play() on loadedmetadata when autoPlay=false (default)', () => {
      const { result, videoRef } = renderWithRefs();
      expect(result.current.isPlaying).toBe(false);
      act(() => {
        Object.defineProperty(videoRef.current, 'duration', { value: 120, configurable: true });
        videoRef.current.dispatchEvent(new Event('loadedmetadata'));
      });
      expect(videoRef.current.play).not.toHaveBeenCalled();
    });
  });
});
