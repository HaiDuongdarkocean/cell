import type { AudioEngineKind, PronunciationAudio } from '../types';

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof globalThis !== 'undefined' && 'AudioContext' in globalThis) {
    return globalThis.AudioContext as typeof AudioContext;
  }
  return undefined;
}

/**
 * Decode an audio URL into a mono `PronunciationAudio` buffer.
 *
 * Multi-channel audio is mixed down to mono so phoneme timeline math and
 * segment playback stay simple.
 */
export async function decodeAudioUrl(
  url: string,
  source: AudioEngineKind,
): Promise<PronunciationAudio> {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    throw new Error('AudioContext is not available in this environment');
  }

  const ctx = new AudioContextCtor();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const { numberOfChannels, length, sampleRate, duration } = audioBuffer;
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < numberOfChannels; c++) {
      sum += audioBuffer.getChannelData(c)[i];
    }
    samples[i] = sum / numberOfChannels;
  }

  // Close the context to release the audio thread.
  await ctx.close();

  return {
    samples,
    sampleRate,
    duration,
    source,
  };
}
