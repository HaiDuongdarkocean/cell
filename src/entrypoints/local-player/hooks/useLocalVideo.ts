import { useCallback, useEffect, useRef, useState } from 'react';
import { isEditableEvent } from '@/features/subtitle/ui/subtitleShortcuts';

/** Playback state exposed by useLocalVideo. */
export interface LocalVideoState {
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly volume: number;
  readonly muted: boolean;
  readonly playbackRate: number;
}

/** Imperative controls returned by useLocalVideo. */
export interface LocalVideoControls extends LocalVideoState {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  togglePiP: () => void;
}

export interface UseLocalVideoOptions {
  /** Throttled callback fired at most once per second on timeupdate. */
  onTimeUpdate?: (currentTime: number) => void;
  /** When the video source changes (new File), re-bind event listeners.
   *  The <video> element is conditionally rendered — when it mounts fresh,
   *  the ref points to a new DOM node and listeners must be re-attached. */
  videoFile?: File | null;
  /** Auto-play when metadata loads (after a new file is picked). Browser
   *  allows autoplay after a user gesture (file picker = gesture); play()
   *  rejection is swallowed in case the policy blocks it. Default false. */
  autoPlay?: boolean;
}

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);
const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

const SHORT_SEEK = 5;
const LONG_SEEK = 10;
/** Throttle for timeupdate → React state + onTimeUpdate callback.
 *  Chrome fires timeupdate ~4x/second; 250ms processes every event so
 *  CueList highlight + progress bar stay in sync with playback. */
const TIME_UPDATE_THROTTLE_MS = 250;

interface KeyboardHandlerDeps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly seek: (time: number) => void;
  readonly toggleMute: () => void;
  readonly toggleFullscreen: () => void;
  readonly setIsPlaying: (playing: boolean) => void;
}

/**
 * Pure keyboard shortcut mapper — exported for testability.
 * Maps a KeyboardEvent to the corresponding playback action.
 */
function handleVideoKeyboardEvent(
  e: KeyboardEvent,
  deps: KeyboardHandlerDeps,
): void {
  const video = deps.videoRef.current;
  if (!video) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (video.paused) {
        void video.play();
        deps.setIsPlaying(true);
      } else {
        video.pause();
        deps.setIsPlaying(false);
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      deps.seek(video.currentTime - (e.shiftKey ? LONG_SEEK : SHORT_SEEK));
      break;
    case 'ArrowRight':
      e.preventDefault();
      deps.seek(video.currentTime + (e.shiftKey ? LONG_SEEK : SHORT_SEEK));
      break;
    case 'm':
    case 'M':
      deps.toggleMute();
      break;
    case 'f':
    case 'F':
      deps.toggleFullscreen();
      break;
    default:
      // 0-9 → seek to 0%-90% of duration (YouTube-style).
      if (e.key >= '0' && e.key <= '9' && video.duration > 0) {
        e.preventDefault();
        const pct = Number(e.key) / 10;
        deps.seek(pct * video.duration);
      }
      break;
  }
}

/**
 * useLocalVideo — manages a `<video>` ref + playback state + keyboard shortcuts.
 *
 * Keyboard shortcuts listen on **window** (bubble phase) so they fire regardless
 * of focus — the `<video>` is not focusable by default, so a container listener
 * would miss the common case where focus is on document.body. Editable targets
 * (input/textarea/select/contenteditable) are skipped so typing isn't blocked.
 */
export function useLocalVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseLocalVideoOptions = {},
): LocalVideoControls {
  const { onTimeUpdate, videoFile, autoPlay = false } = options;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // Keep the latest onTimeUpdate callback without re-binding listeners.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  // Throttle bookkeeping for timeupdate — only emit once per second.
  const lastTimeUpdateEmitRef = useRef(0);
  const pendingTimeRef = useRef(0);

  const play = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    void video.play();
    setIsPlaying(true);
  }, [videoRef]);

  const pause = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
  }, [videoRef]);

  const seek = useCallback(
    (time: number): void => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = clamp(time, 0, video.duration || time);
      video.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [videoRef],
  );

  const setVolume = useCallback(
    (v: number): void => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = clamp01(v);
      video.volume = clamped;
      setVolumeState(clamped);
    },
    [videoRef],
  );

  const setPlaybackRate = useCallback(
    (rate: number): void => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = rate;
      setPlaybackRateState(rate);
    },
    [videoRef],
  );

  const toggleMute = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
      video.muted = next;
      setMuted(next);
  }, [videoRef]);

  const toggleFullscreen = useCallback((): void => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }, [containerRef]);

  const togglePiP = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    const pipVideo = video as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
    };
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture();
    } else if (typeof pipVideo.requestPictureInPicture === 'function') {
      void pipVideo.requestPictureInPicture();
    }
  }, [videoRef]);

  // Attach media event listeners to the video element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = (): void => setIsPlaying(true);
    const handlePause = (): void => setIsPlaying(false);
    const handleLoadedMetadata = (): void => {
      setDuration(video.duration);
      if (autoPlay) {
        // Browser allows autoplay after user gesture (file picker). Swallow
        // rejection — if policy blocks, user can press play manually.
        void video.play().catch(() => {});
      }
    };
    const handleVolumeChange = (): void => {
      setVolumeState(video.volume);
      setMuted(video.muted);
    };
    const handleRateChange = (): void => setPlaybackRateState(video.playbackRate);

    const handleTimeUpdate = (): void => {
      const now = video.currentTime;
      pendingTimeRef.current = now;
      const nowMs = Date.now();
      if (nowMs - lastTimeUpdateEmitRef.current >= TIME_UPDATE_THROTTLE_MS) {
        lastTimeUpdateEmitRef.current = nowMs;
        setCurrentTime(now);
        onTimeUpdateRef.current?.(now);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ratechange', handleRateChange);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, videoFile, autoPlay]);

  // Window listener (not container) — <video> is not focusable, so a container
  // listener would miss the common case where focus is on document.body.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isEditableEvent(e)) return;
      handleVideoKeyboardEvent(e, {
        videoRef,
        seek,
        toggleMute,
        toggleFullscreen,
        setIsPlaying,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoRef, seek, toggleMute, toggleFullscreen]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    playbackRate,
    play,
    pause,
    seek,
    setVolume,
    setPlaybackRate,
    toggleMute,
    toggleFullscreen,
    togglePiP,
  };
}
