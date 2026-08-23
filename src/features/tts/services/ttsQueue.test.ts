import { createTtsAudioQueue, type TtsAudioQueueItem } from './ttsQueue';

interface MockAudioBufferSourceNode {
  buffer: AudioBuffer | null;
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  onended: (() => void) | null;
}

interface MockAudioContext {
  state: string;
  destination: AudioDestinationNode;
  createBuffer: jest.Mock;
  createBufferSource: jest.Mock;
  resume: jest.Mock;
  suspend: jest.Mock;
  close: jest.Mock;
}

describe('createTtsAudioQueue', () => {
  let sources: MockAudioBufferSourceNode[];
  let currentContext: MockAudioContext;
  let originalAudioContext: unknown;

  function makeMockBuffer(): AudioBuffer {
    return { duration: 0.1, length: 4410, sampleRate: 44100, numberOfChannels: 1 } as unknown as AudioBuffer;
  }

  function makeItem(): TtsAudioQueueItem {
    return { audioBuffer: makeMockBuffer() };
  }

  beforeEach(() => {
    sources = [];
    originalAudioContext = (globalThis as Record<string, unknown>).AudioContext;

    currentContext = {
      state: 'running',
      destination: {} as unknown as AudioDestinationNode,
      createBuffer: jest.fn().mockReturnValue(makeMockBuffer()),
      createBufferSource: jest.fn().mockImplementation(() => {
        const source: MockAudioBufferSourceNode = {
          buffer: null,
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          onended: null,
        };
        sources.push(source);
        return source as unknown as AudioBufferSourceNode;
      }),
      resume: jest.fn().mockResolvedValue(undefined),
      suspend: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    (globalThis as Record<string, unknown>).AudioContext = jest
      .fn()
      .mockImplementation(() => currentContext);
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).AudioContext = originalAudioContext;
  });

  it('plays a single queued item', async () => {
    const queue = createTtsAudioQueue();
    const onStart = jest.fn();
    const onEnd = jest.fn();

    queue.enqueue({ audioBuffer: makeMockBuffer(), onStart, onEnd });

    expect(queue.length).toBe(1);
    expect(queue.isPlaying).toBe(true);
    expect(onStart).toHaveBeenCalled();
    expect(sources).toHaveLength(1);

    const [source] = sources;
    await Promise.resolve();
    expect(source.start).toHaveBeenCalled();

    source.onended?.();
    expect(onEnd).toHaveBeenCalled();
    expect(queue.isPlaying).toBe(false);
    expect(queue.length).toBe(1); // queue is not cleared after natural end
  });

  it('plays multiple items in order', () => {
    const queue = createTtsAudioQueue();
    const onEnd1 = jest.fn();
    const onEnd2 = jest.fn();

    queue.enqueue({ audioBuffer: makeMockBuffer(), onEnd: onEnd1 });
    queue.enqueue({ audioBuffer: makeMockBuffer(), onEnd: onEnd2 });

    expect(sources).toHaveLength(1);
    sources[0].onended?.();

    expect(onEnd1).toHaveBeenCalled();
    expect(sources).toHaveLength(2);
    sources[1].onended?.();

    expect(onEnd2).toHaveBeenCalled();
    expect(queue.isPlaying).toBe(false);
  });

  it('pauses and resumes', () => {
    const queue = createTtsAudioQueue();
    queue.enqueue(makeItem());

    expect(queue.isPlaying).toBe(true);
    expect(queue.isPaused).toBe(false);

    queue.pause();
    expect(queue.isPaused).toBe(true);
    expect(queue.isPlaying).toBe(false);
    expect(currentContext.suspend).toHaveBeenCalled();

    queue.resume();
    expect(queue.isPaused).toBe(false);
    expect(queue.isPlaying).toBe(true);
    expect(currentContext.resume).toHaveBeenCalledTimes(2); // initial + resume
  });

  it('stops playback and clears the queue', () => {
    const queue = createTtsAudioQueue();
    queue.enqueue(makeItem());
    queue.enqueue(makeItem());

    queue.stop();

    expect(queue.isPlaying).toBe(false);
    expect(queue.isPaused).toBe(false);
    expect(queue.length).toBe(0);
    expect(sources[0].stop).toHaveBeenCalled();
    expect(currentContext.suspend).toHaveBeenCalled();
  });

  it('does nothing when pause/resume/stop are called while idle', () => {
    const queue = createTtsAudioQueue();

    queue.pause();
    expect(queue.isPaused).toBe(false);

    queue.resume();
    expect(queue.isPlaying).toBe(false);

    queue.stop();
    expect(queue.length).toBe(0);
  });
});
