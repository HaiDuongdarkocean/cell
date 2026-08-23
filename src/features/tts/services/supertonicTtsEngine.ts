// supertonicTtsEngine — local TTS engine for Supertonic v3.
//
// MVP stub: synthesizes a tiny dummy AudioBuffer.
// Next step: replace the stub synthesizer with an offscreen ONNX inference call.

import { createTtsAudioQueue, type TtsAudioQueue } from './ttsQueue';
import type { TtsEngine, TtsSpeakOptions, TtsVoiceInfo } from '@/features/dictionaryPopup/services/ttsEngineService';

const DEFAULT_VOICE: TtsVoiceInfo = {
  voiceName: 'supertonic-v3-en',
  lang: 'en',
};

const VOICES: readonly TtsVoiceInfo[] = [DEFAULT_VOICE];

/** Max chars per synthesis chunk. Sentence-boundary chunking is the goal. */
const MAX_CHARS_PER_CHUNK = 500;

function chunkText(text: string): readonly string[] {
  if (text.length <= MAX_CHARS_PER_CHUNK) return [text];
  // Sentence-based split for natural pauses.
  const sentences = text.split(/(?<=[.!?]\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length <= MAX_CHARS_PER_CHUNK) {
      current += sentence;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length > MAX_CHARS_PER_CHUNK) {
      // Fallback: hard-cut the oversized sentence.
      for (let i = 0; i < sentence.length; i += MAX_CHARS_PER_CHUNK) {
        chunks.push(sentence.slice(i, i + MAX_CHARS_PER_CHUNK));
      }
      current = '';
    } else {
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ponytail: stub synthesizer. Replace with offscreen Supertonic v3 inference.
// Ceiling: only generates a short beep, no real voice. Upgrade path: ttsDownloadManager + offscreen runner.
async function stubSynthesize(_text: string): Promise<AudioBuffer> {
  const Ctx = globalThis.AudioContext as unknown as new () => AudioContext | undefined;
  if (!Ctx) {
    throw new Error('AudioContext is not available');
  }
  const ctx = new Ctx();
  const durationSeconds = 0.1;
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(durationSeconds * sampleRate);
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    data[i] = Math.sin(i * 0.1) * 0.1;
  }
  return buffer;
}

export function createSupertonicTtsEngine(): TtsEngine {
  const queue: TtsAudioQueue = createTtsAudioQueue();
  let activeToken = 0;
  let speakReject: ((reason: Error) => void) | undefined;

  function cancelCurrentSpeak(reason: Error): void {
    activeToken += 1;
    queue.stop();
    speakReject?.(reason);
    speakReject = undefined;
  }

  return {
    async speak(text, _opts: TtsSpeakOptions) {
      cancelCurrentSpeak(new Error('TTS interrupted by new speak'));

      const myToken = (activeToken += 1);
      return new Promise<void>((resolve, reject) => {
        speakReject = reject;
        const chunks = chunkText(text);

        for (let i = 0; i < chunks.length; i++) {
          const isLast = i === chunks.length - 1;
          void stubSynthesize(chunks[i])
            .then((audioBuffer) => {
              if (myToken !== activeToken) return;
              queue.enqueue({
                audioBuffer,
                onEnd: () => {
                  if (myToken !== activeToken) return;
                  if (isLast) {
                    speakReject = undefined;
                    resolve();
                  }
                },
              });
            })
            .catch((err) => {
              if (myToken !== activeToken) return;
              speakReject = undefined;
              reject(err instanceof Error ? err : new Error(String(err)));
            });
        }
      });
    },
    getVoices() {
      return Promise.resolve(VOICES);
    },
    stop() {
      cancelCurrentSpeak(new Error('TTS stopped'));
    },
  };
}
