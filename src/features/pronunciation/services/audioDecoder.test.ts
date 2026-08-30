import { decodeAudioUrl } from './audioDecoder';

function createMockAudioBuffer(data: number[], sampleRate = 22050): AudioBuffer {
  const length = data.length;
  const buffer = {
    numberOfChannels: 1,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: jest.fn().mockReturnValue(new Float32Array(data)),
  } as unknown as AudioBuffer;
  return buffer;
}

function setupAudioContextMock(audioBuffer: AudioBuffer, responseOk = true): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: responseOk,
    status: 200,
    statusText: 'OK',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  }) as unknown as typeof fetch;

  const decodeAudioData = jest.fn().mockResolvedValue(audioBuffer);
  const close = jest.fn().mockResolvedValue(undefined);

  global.AudioContext = jest.fn().mockImplementation(() => ({
    decodeAudioData,
    close,
  })) as unknown as typeof AudioContext;
}

describe('decodeAudioUrl', () => {
  it('decodes a mono audio URL into PronunciationAudio', async () => {
    const data = [0.1, 0.2, 0.3, 0.4];
    setupAudioContextMock(createMockAudioBuffer(data));

    const result = await decodeAudioUrl('https://example.com/audio.mp3', 'native');

    expect(result.source).toBe('native');
    expect(result.sampleRate).toBe(22050);
    expect(result.duration).toBe(4 / 22050);
    expect(result.samples).toEqual(new Float32Array(data));
  });

  it('mixes multi-channel audio to mono', async () => {
    const left = [0.2, 0.4];
    const right = [0.4, 0.8];
    const buffer = {
      numberOfChannels: 2,
      length: 2,
      sampleRate: 22050,
      duration: 2 / 22050,
      getChannelData: jest.fn()
        .mockImplementation((c: number) => (c === 0 ? new Float32Array(left) : new Float32Array(right))),
    } as unknown as AudioBuffer;

    setupAudioContextMock(buffer);

    const result = await decodeAudioUrl('https://example.com/audio.mp3', 'supertonic');

    expect(result.samples).toEqual(new Float32Array([0.3, 0.6]));
    expect(result.source).toBe('supertonic');
  });

  it('throws when the audio fetch fails', async () => {
    setupAudioContextMock(createMockAudioBuffer([0.1]), false);

    await expect(decodeAudioUrl('https://example.com/audio.mp3', 'native')).rejects.toThrow(
      'Failed to fetch audio',
    );
  });
});
