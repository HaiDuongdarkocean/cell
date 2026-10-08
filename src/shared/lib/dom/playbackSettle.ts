// playbackSettle — serialize programmatic playback commands against the
// media element's event queue.
//
// Some host players (e.g. KissKH's mat-play-button instances) keep an
// internal `play` flag synced from 'play'/'pause' events by TOGGLING:
// setVideoPlayback(w) flips the flag and calls video.play()/pause() when the
// flag differs from the event's implied state. Media events are queued, so a
// pause() and play() issued in the same task epoch each produce a real
// transition processed against a stale flag — the handler then issues the
// opposite command, which produces another event, forever (observed: ~570
// pause/play transitions per second with no user input). Once started the
// oscillator is self-sustaining; the only safe posture is to never issue a
// command while an opposite event could still be in flight.
//
// runWhenMediaSettled schedules a command for the first task where the media
// has been quiet — no playback-state events delivered and no settle-issued
// command for QUIET_MS — so every command lands on a converged state.
// The extra one-task defer also lets same-dispatch host handlers (a click
// that seeks or resumes) finish before we measure.

const TRACKED_EVENTS = [
  'play',
  'pause',
  'playing',
  'seeking',
  'seeked',
  'waiting',
  'canplaythrough',
  'ended',
] as const;

export const MEDIA_SETTLE_QUIET_MS = 200;
const MEDIA_SETTLE_POLL_MS = 40;
const MEDIA_SETTLE_MAX_WAIT_MS = 1500;

interface MediaSettleState {
  installed: boolean;
  lastEventAt: number;
  lastIssuedAt: number;
}

const mediaStates = new WeakMap<HTMLVideoElement, MediaSettleState>();

function mediaStateFor(video: HTMLVideoElement): MediaSettleState {
  let state = mediaStates.get(video);
  if (!state) {
    state = { installed: false, lastEventAt: 0, lastIssuedAt: 0 };
    mediaStates.set(video, state);
  }
  if (!state.installed && typeof video.addEventListener === 'function') {
    state.installed = true;
    const mark = () => { state.lastEventAt = Date.now(); };
    for (const type of TRACKED_EVENTS) video.addEventListener(type, mark);
  }
  return state;
}

/** Run `fn` once the video's playback has been quiet for MEDIA_SETTLE_QUIET_MS
 *  (or after MEDIA_SETTLE_MAX_WAIT_MS if it never goes quiet). Always deferred
 *  at least one task. Returns a cancel function. */
export function runWhenMediaSettled(video: HTMLVideoElement, fn: () => void): () => void {
  const state = mediaStateFor(video);
  const deadline = Date.now() + MEDIA_SETTLE_MAX_WAIT_MS;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(attempt, 0);

  function attempt(): void {
    timer = null;
    if (cancelled) return;
    const now = Date.now();
    const quiet = video.seeking !== true
      && now - state.lastEventAt >= MEDIA_SETTLE_QUIET_MS
      && now - state.lastIssuedAt >= MEDIA_SETTLE_QUIET_MS;
    if (!quiet && now < deadline) {
      timer = setTimeout(attempt, MEDIA_SETTLE_POLL_MS);
      return;
    }
    state.lastIssuedAt = now;
    fn();
  }

  return () => {
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
