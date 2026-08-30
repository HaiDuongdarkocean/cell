import { playPhoneme } from './phonemeAudioPlayer';

function createMockAudioBufferSource(): AudioBufferSourceNode {
  const source = {
    buffer: null as AudioBuffer | null,
    connect: jest.fn(),
    start: jest.fn(),
    onended: null as (() => void) | null,
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
    if (source.onended) source.onended();
    await expect(promise).resolves.toBeUndefined();
  });
});
