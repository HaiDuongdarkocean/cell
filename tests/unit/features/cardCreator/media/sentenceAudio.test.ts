import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { captureSentenceAudio, seekAndWaitReady } from '@/features/cardCreator/media/sentenceAudio';

interface FakeVideo {
  currentTime: number;
  readyState: number;
  paused: boolean;
  ended: boolean;
  videoWidth: number;
  addEventListener: (type: string, fn: EventListener) => void;
  removeEventListener: (type: string, fn: EventListener) => void;
  fire: (type: string) => void;
  play: () => Promise<void>;
  pause: () => void;
  captureStream?: () => { getAudioTracks: () => unknown[] };
}

function makeVideo(overrides: Partial<FakeVideo> = {}): FakeVideo {
  const listeners = new Map<string, Set<EventListener>>();
  const video: FakeVideo = {
    currentTime: 0,
    readyState: 4,
    paused: true,
    ended: false,
    videoWidth: 640,
    addEventListener(type, fn) {
      const set = listeners.get(type) ?? new Set<EventListener>();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    fire(type) {
      for (const fn of listeners.get(type) ?? []) fn(new Event(type));
    },
    play() {
      video.paused = false;
      return Promise.resolve();
    },
    pause() {
      video.paused = true;
    },
    captureStream() {
      return { getAudioTracks: () => [{}] };
    },
    ...overrides,
  };
  return video;
}

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = jest.fn(() => true);

  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state: 'inactive' | 'recording' = 'inactive';

  constructor() {
    FakeMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = 'recording';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
    });
  }

  stop(): void {
    this.state = 'inactive';
    this.onstop?.();
  }
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('seekAndWaitReady', () => {
  it('resolves true once the seek lands within tolerance and data is ready', async () => {
    const video = makeVideo({ readyState: 0 });
    const pending = seekAndWaitReady(video as unknown as HTMLVideoElement, 10);
    video.currentTime = 10;
    video.readyState = 2;
    video.fire('seeked');
    await expect(pending).resolves.toBe(true);
  });

  it('resolves false when the seek never lands within tolerance', async () => {
    const video = makeVideo({ currentTime: 3 });
    // Hostile player ignores the seek — position stays at 3.
    Object.defineProperty(video, 'currentTime', { get: () => 3, set: () => undefined, configurable: true });
    const pending = seekAndWaitReady(video as unknown as HTMLVideoElement, 10, 100);
    await jest.advanceTimersByTimeAsync(150);
    await expect(pending).resolves.toBe(false);
  });

  it('resolves true immediately when already positioned and ready', async () => {
    const video = makeVideo({ currentTime: 10, readyState: 4 });
    await expect(seekAndWaitReady(video as unknown as HTMLVideoElement, 10)).resolves.toBe(true);
  });
});

describe('captureSentenceAudio', () => {
  let savedRecorder: unknown;
  let savedStream: unknown;
  let savedHidden: PropertyDescriptor | undefined;

  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
      Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
        // Microtask-only polyfill — deterministic under fake timers.
        return Promise.resolve(new ArrayBuffer(this.size));
      };
    }
    savedRecorder = globalThis.MediaRecorder;
    savedStream = globalThis.MediaStream;
    savedHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeMediaRecorder;
    (globalThis as { MediaStream?: unknown }).MediaStream = class {
      constructor(public tracks: unknown[]) {}
    };
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => false });
  });

  afterEach(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = savedRecorder;
    (globalThis as { MediaStream?: unknown }).MediaStream = savedStream;
    if (savedHidden) Object.defineProperty(Document.prototype, 'hidden', savedHidden);
  });

  it('returns hidden when the document is hidden', async () => {
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
    const video = makeVideo();
    const result = await captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 0, end: 1000 });
    expect(result).toEqual({ ok: false, reason: 'hidden' });
  });

  it('returns unsupported when captureStream is missing', async () => {
    const video = makeVideo({ captureStream: undefined });
    const result = await captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 0, end: 1000 });
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('returns failed for a non-positive cue duration without seeking', async () => {
    const video = makeVideo();
    const result = await captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 1000, end: 1000 });
    expect(result).toMatchObject({ ok: false, reason: 'failed' });
  });

  it('records and pauses after the cue duration elapses', async () => {
    const video = makeVideo({ currentTime: 10 });
    const pending = captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 10000, end: 11000 });
    // seek lands instantly (seekVideo sets currentTime; poll resolves).
    await jest.advanceTimersByTimeAsync(60);
    // Playback timeout finish (duration 1s + 500ms buffer).
    await jest.advanceTimersByTimeAsync(2000);
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(video.paused).toBe(true);
  });

  it('fails cleanly when the seek cannot reach the cue start', async () => {
    const video = makeVideo({ currentTime: 0 });
    // Hostile player ignores the seek — position never moves.
    Object.defineProperty(video, 'currentTime', { get: () => 0, set: () => undefined, configurable: true });
    const pending = captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 60000, end: 62000 });
    await jest.advanceTimersByTimeAsync(4500);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, reason: 'failed', error: 'Seek did not reach cue start' });
  });

  it('stops early when the video ends before the cue duration elapses', async () => {
    const video = makeVideo({ currentTime: 10 });
    const pending = captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 10000, end: 20000 });
    await jest.advanceTimersByTimeAsync(60);
    video.fire('ended');
    await jest.advanceTimersByTimeAsync(60);
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(video.paused).toBe(true);
  });

  it('serializes concurrent captures so two lookups cannot fight over position', async () => {
    const video = makeVideo({ currentTime: 10 });
    const order: number[] = [];
    const first = captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 10000, end: 11000 });
    const second = captureSentenceAudio(video as unknown as HTMLVideoElement, { start: 20000, end: 21000 });
    FakeMediaRecorder.prototype.start = function (this: FakeMediaRecorder): void {
      order.push(FakeMediaRecorder.instances.indexOf(this));
      this.state = 'recording';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
      });
    };
    await jest.runAllTimersAsync();
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(order).toEqual([0, 1]);
  });
});
