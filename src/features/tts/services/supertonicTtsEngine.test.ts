import { createSupertonicTtsEngine } from './supertonicTtsEngine';

interface MockAudioBufferSourceNode {
  buffer: AudioBuffer | null;
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  onended: (() => void) | null;
}

interface MockAudioContext {
  state: string;
  sampleRate: number;
  destination: AudioDestinationNode;
  createBuffer: jest.Mock;
  createBufferSource: jest.Mock;
  resume: jest.Mock;
  suspend: jest.Mock;
}

describe('createSupertonicTtsEngine', () => {
  let sources: MockAudioBufferSourceNode[];
  let currentContext: MockAudioContext;
  let originalAudioContext: unknown;

  beforeEach(() => {
    sources = [];
    originalAudioContext = (globalThis as Record<string, unknown>).AudioContext;

    currentContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {} as unknown as AudioDestinationNode,
      createBuffer: jest.fn().mockImplementation((_ch: number, len: number, _sr: number) => {
        const data = new Float32Array(len);
        return {
          duration: len / 44100,
          length: len,
          sampleRate: 44100,
          numberOfChannels: 1,
          getChannelData: jest.fn().mockReturnValue(data),
        } as unknown as AudioBuffer;
      }),
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
    };

    (globalThis as Record<string, unknown>).AudioContext = jest
      .fn()
      .mockImplementation(() => currentContext);
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).AudioContext = originalAudioContext;
  });

  it('returns the Supertonic voice list', async () => {
    const engine = createSupertonicTtsEngine();
    const voices = await engine.getVoices();
    expect(voices).toHaveLength(1);
    expect(voices[0]).toEqual({ voiceName: 'supertonic-v3-en', lang: 'en' });
  });

  it('speaks a short word and resolves when audio ends', async () => {
    const engine = createSupertonicTtsEngine();
    const speakPromise = engine.speak('hello', {});

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sources).toHaveLength(1);
    sources[0].onended?.();

    await expect(speakPromise).resolves.toBeUndefined();
  });

  it('stops an active speak and rejects the promise', async () => {
    const engine = createSupertonicTtsEngine();
    const speakPromise = engine.speak('hello', {});
    engine.stop();

    await expect(speakPromise).rejects.toThrow('TTS stopped');
  });

  it('interrupts the previous speak when a new speak is requested', async () => {
    const engine = createSupertonicTtsEngine();
    const first = engine.speak('hello', {});
    const second = engine.speak('world', {});

    await expect(first).rejects.toThrow('TTS interrupted by new speak');

    await Promise.resolve();
    await Promise.resolve();

    expect(sources).toHaveLength(1);
    sources[0].onended?.();

    await expect(second).resolves.toBeUndefined();
  });
});
