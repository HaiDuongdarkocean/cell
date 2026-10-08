import { runWhenMediaSettled, MEDIA_SETTLE_QUIET_MS } from './playbackSettle';

function makeVideo(): HTMLVideoElement {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    seeking: false,
    addEventListener: (type: string, fn: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    dispatchEvent: (e: Event) => {
      listeners.get(e.type)?.forEach((fn) => fn(e));
      return true;
    },
  } as unknown as HTMLVideoElement;
}

describe('runWhenMediaSettled', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs after one task when the media is quiet', () => {
    const fn = jest.fn();
    runWhenMediaSettled(makeVideo(), fn);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits for a delivered playback event to age past the quiet window', () => {
    const video = makeVideo();
    runWhenMediaSettled(video, jest.fn());
    jest.advanceTimersByTime(1);
    video.dispatchEvent(new Event('play'));
    const fn = jest.fn();
    runWhenMediaSettled(video, fn);
    jest.advanceTimersByTime(MEDIA_SETTLE_QUIET_MS - 50);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('serializes consecutive commands so each lands on a settled state', () => {
    const video = makeVideo();
    const order: string[] = [];
    runWhenMediaSettled(video, () => order.push('play'));
    runWhenMediaSettled(video, () => order.push('pause'));
    jest.advanceTimersByTime(1);
    expect(order).toEqual(['play']);
    jest.advanceTimersByTime(MEDIA_SETTLE_QUIET_MS + 50);
    expect(order).toEqual(['play', 'pause']);
  });

  it('waits while the video is seeking', () => {
    const video = makeVideo();
    (video as { seeking: boolean }).seeking = true;
    const fn = jest.fn();
    runWhenMediaSettled(video, fn);
    jest.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
    (video as { seeking: boolean }).seeking = false;
    jest.advanceTimersByTime(MEDIA_SETTLE_QUIET_MS + 50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires anyway after the max wait when the media never goes quiet', () => {
    const video = makeVideo();
    (video as { seeking: boolean }).seeking = true;
    const fn = jest.fn();
    runWhenMediaSettled(video, fn);
    jest.advanceTimersByTime(1600);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents the run', () => {
    const fn = jest.fn();
    const cancel = runWhenMediaSettled(makeVideo(), fn);
    cancel();
    jest.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});
