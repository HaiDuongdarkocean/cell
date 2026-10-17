import type { AudioEngineKind, PronunciationAudio } from '../types';

/**
 * Decode an audio URL into a mono `PronunciationAudio` buffer.
 *
 * Decoding runs on an OfflineAudioContext — a decode-only job needs no
 * realtime audio thread, so autoplay policy cannot suspend it and there is
 * no AudioContext.close() to stall (a suspended context's close() hangs for
 * seconds on Brave).
 *
 * Multi-channel audio is mixed down to mono so phoneme timeline math and
 * segment playback stay simple.
 */
export async function decodeAudioUrl(
  url: string,
  source: AudioEngineKind,
): Promise<PronunciationAudio> {
  const useOffline = typeof OfflineAudioContext === 'function';
  const RealtimeCtor = globalThis.AudioContext;
  if (!useOffline && typeof RealtimeCtor !== 'function') {
    throw new Error('AudioContext is not available in this environment');
  }
  const ctx: BaseAudioContext = useOffline
    ? new OfflineAudioContext(1, 1, 44100)
    : new RealtimeCtor!();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const { numberOfChannels, length, sampleRate, duration } = audioBuffer;
  let samples: Float32Array;

  if (numberOfChannels === 1) {
    samples = audioBuffer.getChannelData(0).slice();
  } else {
    const channels = Array.from({ length: numberOfChannels }, (_, c) => audioBuffer.getChannelData(c));
    samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (const ch of channels) {
        sum += ch[i];
      }
      samples[i] = sum / numberOfChannels;
    }
  }

  // Realtime contexts hold an audio thread — close it without awaiting so a
  // stalled close() can never delay the decoded audio.
  if (!useOffline) void (ctx as AudioContext).close();

  return {
    samples,
    sampleRate,
    duration,
    source,
  };
}
