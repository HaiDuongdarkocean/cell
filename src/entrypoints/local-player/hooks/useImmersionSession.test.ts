import { act, renderHook } from '@testing-library/react';
import { useImmersionSession } from './useImmersionSession';
import type { HistoryRecord } from '@/features/local-player/services/mediaLibraryRepository';

const writes: HistoryRecord[] = [];
const addHistoryEntryMock = jest.fn(async (r: HistoryRecord) => {
  writes.push({ ...r });
});
jest.mock('@/features/local-player/services/mediaLibraryRepository', () => ({
  addHistoryEntry: (r: HistoryRecord) => addHistoryEntryMock(r),
}));

const makeVideo = (): HTMLVideoElement => document.createElement('video');

const setPaused = (video: HTMLVideoElement, paused: boolean): void => {
  Object.defineProperty(video, 'paused', { value: paused, configurable: true });
};

const fire = (video: HTMLVideoElement, type: string): void => {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
};

const advance = (ms: number): void => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

describe('useImmersionSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    writes.length = 0;
    addHistoryEntryMock.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('accumulates wall time while playing and flushes at 15s', async () => {
    const video = makeVideo();
    setPaused(video, false);
    const ref = { current: video };
    renderHook(() => useImmersionSession(ref, 'v1', null));

    for (let i = 0; i < 64; i += 1) {
      advance(250);
      fire(video, 'timeupdate');
    }
    await act(async () => {});
    expect(writes.length).toBeGreaterThanOrEqual(1);
    const last = writes[writes.length - 1];
    expect(last.id).toMatch(/^watch-v1-\d+$/);
    expect(last.videoId).toBe('v1');
    expect(last.watchDurationMs).toBeGreaterThanOrEqual(15_000);
    expect(last.watchDurationMs).toBeLessThanOrEqual(17_000);
  });

  it('drops accumulation while paused (seek timeupdate)', () => {
    const video = makeVideo();
    setPaused(video, false);
    const ref = { current: video };
    renderHook(() => useImmersionSession(ref, 'v1', null));

    for (let i = 0; i < 8; i += 1) {
      advance(250);
      fire(video, 'timeupdate');
    }
    setPaused(video, true);
    for (let i = 0; i < 40; i += 1) {
      advance(250);
      fire(video, 'timeupdate');
    }
    expect(writes.length).toBe(0);
  });

  it('pause closes the segment with a final upsert (sub-15s writes once)', async () => {
    const video = makeVideo();
    setPaused(video, false);
    const ref = { current: video };
    renderHook(() => useImmersionSession(ref, 'v1', null));

    for (let i = 0; i < 20; i += 1) {
      advance(250);
      fire(video, 'timeupdate');
    }
    fire(video, 'pause');
    await act(async () => {});
    expect(writes.length).toBe(1);
    expect(writes[0].watchDurationMs).toBeGreaterThan(0);
    expect(writes[0].watchDurationMs).toBeLessThan(15_000);

    setPaused(video, false);
    for (let i = 0; i < 8; i += 1) {
      advance(250);
      fire(video, 'timeupdate');
    }
    fire(video, 'pause');
    await act(async () => {});
    expect(writes.length).toBe(2);
    expect(writes[1].id).not.toBe(writes[0].id);
  });

  it('unmount flushes the open segment once', async () => {
    const video = makeVideo();
    setPaused(video, false);
    const ref = { current: video };
    const { unmount } = renderHook(() => useImmersionSession(ref, 'v1', null));

    for (let i = 0; i < 20; i += 1) {
      advance(250);
      fire(video, 'timeupdate');
    }
    unmount();
    await act(async () => {});
    expect(writes.length).toBe(1);
  });

  it('writes nothing for a zero-time segment', () => {
    const video = makeVideo();
    setPaused(video, true);
    const ref = { current: video };
    const { unmount } = renderHook(() => useImmersionSession(ref, 'v1', null));
    fire(video, 'timeupdate');
    unmount();
    expect(writes.length).toBe(0);
  });

  it('does not attach when videoId is null', () => {
    const video = makeVideo();
    setPaused(video, false);
    const ref = { current: video };
    const { unmount } = renderHook(() => useImmersionSession(ref, null, null));
    for (let i = 0; i < 20; i += 1) {
      advance(250);
      fire(video, 'timeupdate');
    }
    unmount();
    expect(writes.length).toBe(0);
  });

  it('re-binds when the video element remounts (videoFile change)', async () => {
    const videoA = makeVideo();
    const videoB = makeVideo();
    setPaused(videoA, false);
    setPaused(videoB, false);
    const ref = { current: videoA as HTMLVideoElement | null };
    const fileA = new File([], 'a.mp4');
    const fileB = new File([], 'b.mp4');

    const { rerender, unmount } = renderHook(
      ({ file }) => useImmersionSession(ref, 'v1', file),
      { initialProps: { file: fileA } },
    );
    for (let i = 0; i < 8; i += 1) {
      advance(250);
      fire(videoA, 'timeupdate');
    }
    ref.current = videoB;
    rerender({ file: fileB });

    for (let i = 0; i < 20; i += 1) {
      advance(250);
      fire(videoB, 'timeupdate');
    }
    unmount();
    await act(async () => {});
    const bWrite = writes[writes.length - 1];
    expect(bWrite.watchDurationMs).toBeGreaterThan(0);
  });
});
