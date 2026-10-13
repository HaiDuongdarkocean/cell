/**
 * The vendored eSpeak worker transfers audio as Float32 stereo-interleaved
 * samples (L=R duplicated: `data[i*2]=v; data[i*2+1]=v`). Downmix by keeping
 * every other frame. Reading the buffer as mono would double the duration
 * and drop the pitch an octave.
 */
export function espeakStereoToMono(frames: Float32Array | number[]): Float32Array {
  const mono = new Float32Array(Math.floor(frames.length / 2));
  for (let i = 0; i < mono.length; i++) {
    mono[i] = frames[i * 2]!;
  }
  return mono;
}

const SILENCE_THRESHOLD = 0.02;
const EDGE_MARGIN_RATIO = 0.01;
const TARGET_PEAK = 0.65;

/**
 * Isolated-phoneme clips arrive with head/tail silence and wildly uneven
 * levels (a bare fricative peaks ~15 dB below a vowel). Trim the dead margin
 * — keeping a short lead so a stop's release burst is not clipped — then
 * normalize peak amplitude so every chip plays at the same loudness.
 */
export function trimAndNormalizePcm(samples: Float32Array, sampleRate: number): Float32Array {
  const margin = Math.round(sampleRate * EDGE_MARGIN_RATIO);
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]!) < SILENCE_THRESHOLD) start++;
  if (start === samples.length) return samples;
  let end = samples.length;
  while (end > start && Math.abs(samples[end - 1]!) < SILENCE_THRESHOLD) end--;
  start = Math.max(0, start - margin);
  end = Math.min(samples.length, end + margin);
  const clipped = samples.slice(start, end);
  if (clipped.length === 0) return samples;
  let peak = 0;
  for (let i = 0; i < clipped.length; i++) {
    const a = Math.abs(clipped[i]!);
    if (a > peak) peak = a;
  }
  if (peak === 0 || peak === TARGET_PEAK) return clipped;
  const gain = TARGET_PEAK / peak;
  for (let i = 0; i < clipped.length; i++) clipped[i] = clipped[i]! * gain;
  return clipped;
}
