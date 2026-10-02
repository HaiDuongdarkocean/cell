import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  startCondensedAudioSession,
  setCondensedAudioSessionPaused,
  stopCondensedAudioSession,
  isCondensedAudioSessionActive,
} from './condensedAudioRecorder';
import type { CondensedAudioPillHandlers } from './ui/mountCondensedAudioPill';

const mockSendMessage = jest.fn((..._args: unknown[]) => Promise.resolve({ success: true }));
jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

let mockPillHandlers: CondensedAudioPillHandlers | null = null;
const mockSetPaused = jest.fn();
jest.mock('./ui/mountCondensedAudioPill', () => ({
  mountCondensedAudioPill: (_video: unknown, handlers: CondensedAudioPillHandlers) => {
    mockPillHandlers = handlers;
    return { updatePosition: jest.fn(), setPaused: mockSetPaused, unmount: jest.fn() };
  },
}));

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = jest.fn(() => true);

  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly mimeType = 'audio/webm;codecs=opus';
  state: 'inactive' | 'recording' | 'paused' = 'inactive';

  constructor() {
    FakeMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = 'recording';
  }

  pause(): void {
    if (this.state === 'recording') this.state = 'paused';
  }

  resume(): void {
    if (this.state === 'paused') this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.onstop?.();
  }
}

interface FakeVideo {
  el: HTMLVideoElement;
  setTime: (v: number) => void;
  setSeeking: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  isPaused: () => boolean;
}

function makeVideo(): FakeVideo {
  const el = document.createElement('video');
  let currentTime = 0;
  let paused = true;
  let seeking = false;
  const ended = false;
  Object.defineProperty(el, 'duration', { value: 120, configurable: true });
  Object.defineProperty(el, 'currentTime', {
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v;
    },
    configurable: true,
  });
  Object.defineProperty(el, 'paused', { get: () => paused, configurable: true });
  Object.defineProperty(el, 'seeking', { get: () => seeking, configurable: true });
  Object.defineProperty(el, 'ended', { get: () => ended, configurable: true });
  el.play = () => {
    paused = false;
    return Promise.resolve();
  };
  el.pause = () => {
    paused = true;
  };
  const track = { stop: jest.fn() };
  (el as HTMLVideoElement & { captureStream: () => unknown }).captureStream = () => ({
    getAudioTracks: () => [track],
    getTracks: () => [track],
  });
  document.body.appendChild(el);
  return {
    el,
    setTime: (v) => {
      currentTime = v;
    },
    setSeeking: (v) => {
      seeking = v;
    },
    setPaused: (v) => {
      paused = v;
    },
    isPaused: () => paused,
  };
}

const RANGES = [
  { startMs: 1000, endMs: 3000 },
  { startMs: 10000, endMs: 12000 },
];

function chunkPayloads(): Record<string, unknown>[] {
  return mockSendMessage.mock.calls
    .map(([msg]) => msg as unknown as { type: string; payload: Record<string, unknown> })
    .filter((msg) => msg.type === MESSAGE_TYPES.CONDENSE_AUDIO_CHUNK)
    .map((msg) => msg.payload);
}

describe('startCondensedAudioSession', () => {
  let video: FakeVideo;
  let recorder: FakeMediaRecorder;
  let savedRecorder: unknown;
  let savedStream: unknown;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeMediaRecorder.instances = [];
    mockPillHandlers = null;
    mockSendMessage.mockClear();
    mockSetPaused.mockClear();
    savedRecorder = globalThis.MediaRecorder;
    savedStream = globalThis.MediaStream;
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeMediaRecorder;
    (globalThis as { MediaStream?: unknown }).MediaStream = class {
      readonly tracks: unknown[];
      constructor(tracks: unknown[]) {
        this.tracks = tracks;
      }
      getTracks(): unknown[] {
        return this.tracks;
      }
    };
    video = makeVideo();
    const result = startCondensedAudioSession('rec-1', RANGES);
    recorder = FakeMediaRecorder.instances[0]!;
    expect(result).toEqual({ ok: true });
  });

  afterEach(() => {
    stopCondensedAudioSession('rec-1');
    video.el.remove();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = savedRecorder;
    (globalThis as { MediaStream?: unknown }).MediaStream = savedStream;
    jest.useRealTimers();
  });

  it('keeps the recorder paused until playback enters the first cue range', () => {
    expect(recorder.state).toBe('paused');
    expect(video.el.currentTime).toBe(1);
    video.setSeeking(false);
    video.setPaused(false);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('recording');
  });

  it('pauses capture across gaps and resumes at the next cue range', () => {
    video.setPaused(false);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('recording');
    video.setTime(5);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('paused');
    expect(video.el.currentTime).toBe(10);
    video.setSeeking(true);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('paused');
    video.setSeeking(false);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('recording');
  });

  it('finalizes once every range has been recorded', async () => {
    video.setPaused(false);
    video.setTime(13);
    await jest.advanceTimersByTimeAsync(200);
    const last = chunkPayloads().find((p) => p.last === true);
    expect(last).toBeDefined();
    expect(isCondensedAudioSessionActive()).toBe(false);
    expect(video.isPaused()).toBe(true);
  });

  it('user pause halts capture and playback, resume restores both', () => {
    video.setPaused(false);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('recording');
    setCondensedAudioSessionPaused('rec-1', true);
    expect(recorder.state).toBe('paused');
    expect(video.isPaused()).toBe(true);
    expect(mockSetPaused).toHaveBeenCalledWith(true);
    video.setTime(5);
    jest.advanceTimersByTime(200);
    expect(video.el.currentTime).toBe(5);
    setCondensedAudioSessionPaused('rec-1', false);
    expect(video.isPaused()).toBe(false);
    expect(video.el.currentTime).toBe(10);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('recording');
  });

  it('treats an external site pause inside a range as user pause', () => {
    video.setPaused(false);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('recording');
    video.setPaused(true);
    jest.advanceTimersByTime(200);
    expect(recorder.state).toBe('paused');
    expect(mockSetPaused).toHaveBeenCalledWith(true);
  });

  it('pill discard aborts the session and reports cancelled', () => {
    mockPillHandlers!.onDiscard();
    const payloads = chunkPayloads();
    expect(payloads.some((p) => p.error === 'cancelled')).toBe(true);
    expect(isCondensedAudioSessionActive()).toBe(false);
    expect(video.isPaused()).toBe(true);
  });
});
