import type { Phoneme, PronunciationAudio } from '../types';

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = globalThis.AudioContext as typeof AudioContext | undefined;
    if (!Ctor) throw new Error('AudioContext not available');
    sharedContext = new Ctor();
  }
  return sharedContext;
}

/**
 * Play a single phoneme segment from a word audio buffer.
 *
 * Returns a promise that resolves when playback ends (or rejects on error).
 * If `pronunciationAudio` is null, the function does nothing and resolves
 * immediately (used when no audio source is available).
 */
export function playPhoneme(
  audio: PronunciationAudio | null,
  phoneme: Phoneme,
): Promise<void> {
  if (!audio) return Promise.resolve();

  const ctx = getAudioContext();
  const startSample = Math.floor((phoneme.startMs / 1000) * audio.sampleRate);
  const endSample = Math.min(
    Math.floor((phoneme.endMs / 1000) * audio.sampleRate),
    audio.samples.length,
  );
  const segment = audio.samples.slice(startSample, endSample);

  if (segment.length === 0) return Promise.resolve();

  const buffer = ctx.createBuffer(1, segment.length, audio.sampleRate);
  buffer.getChannelData(0).set(segment);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  return (async (): Promise<void> => {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start(0);
    });
  })();
}
