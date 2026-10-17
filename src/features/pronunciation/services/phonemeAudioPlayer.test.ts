import { playPhoneme } from './phonemeAudioPlayer';

function createMockAudioBufferSource(): AudioBufferSourceNode {
  const source = {
    buffer: null as AudioBuffer | null,
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(() => { source.onended?.({} as Event); }),
    onended: null as ((ev: Event) => void) | null,
  } as unknown as AudioBufferSourceNode;
  return source;
}

function setupAudioContextMock(samples: number[], sampleRate = 22050): void {
  const source = createMockAudioBufferSource();
  const ctx = {
    state: 'suspended',
    resume: jest.fn().mockResolvedValue(undefined),
    createBuffer: jest.fn().mockReturnValue({
      getChannelData: jest.fn().mockReturnValue(new Float32Array(samples.length)),
      sampleRate,
      length: samples.length,
    } as unknown as AudioBuffer),
    createBufferSource: jest.fn().mockReturnValue(source),
    destination: {} as AudioDestinationNode,
  } as unknown as AudioContext;

  global.AudioContext = jest.fn().mockImplementation(() => ctx) as unknown as typeof AudioContext;
}

describe('playPhoneme', () => {
  it('does nothing when pronunciationAudio is null', async () => {
    await expect(playPhoneme(null, { ipa: 'h', startMs: 0, endMs: 100, type: 'consonant' })).resolves.toBeUndefined();
  });

  it('resumes AudioContext when suspended and starts playback', async () => {
    const samples = new Array(22050).fill(0).map((_, i) => i / 22050);
    setupAudioContextMock(samples);

    const audio = { samples: new Float32Array(samples), sampleRate: 22050, duration: 1, source: 'native' as const };
    const promise = playPhoneme(audio, { ipa: 'h', startMs: 0, endMs: 100, type: 'consonant' });

    const ctx = new (global.AudioContext)();
    const source = ctx.createBufferSource();

    // Flush the async resume + start scheduling.
    await Promise.resolve();

    expect(ctx.resume).toHaveBeenCalled();
    expect(source.start).toHaveBeenCalledWith(0);

    // Simulate playback ended.
    if (source.onended) source.onended({} as Event);
    await expect(promise).resolves.toBeUndefined();
  });

  it('stops the previous clip so only one phoneme sounds at a time', async () => {
    jest.resetModules();
    const { playPhoneme: play } = await import('./phonemeAudioPlayer');

    const sources: AudioBufferSourceNode[] = [];
    const ctx = {
      state: 'running',
      resume: jest.fn(),
      createBuffer: jest.fn().mockReturnValue({
        getChannelData: jest.fn().mockReturnValue(new Float32Array(4)),
      }),
      createBufferSource: jest.fn(() => {
        const s = createMockAudioBufferSource();
        sources.push(s);
        return s;
      }),
      destination: {} as AudioDestinationNode,
    } as unknown as AudioContext;
    global.AudioContext = jest.fn(() => ctx) as unknown as typeof AudioContext;

    const audio = { samples: new Float32Array(4), sampleRate: 22050, duration: 1, source: 'native' as const };
    const phoneme = { ipa: 'h', startMs: 0, endMs: 100, type: 'consonant' as const };

    const p1 = play(audio, phoneme);
    const p2 = play(audio, phoneme);
    await Promise.resolve();

    expect(sources[0].stop).toHaveBeenCalledTimes(1);
    expect(sources[1].start).toHaveBeenCalledWith(0);

    if (sources[1].onended) sources[1].onended({} as Event);
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).resolves.toBeUndefined();
  });
});
