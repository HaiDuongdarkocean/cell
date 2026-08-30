import { useCallback, useState } from 'react';
import { PronunciationPanel } from '@/features/pronunciation/ui/PronunciationPanel';
import { playEspeakWord, playEspeakPhoneme } from '@/features/pronunciation/services/espeakAudioEngine';
import type { Phoneme, PronunciationResult } from '@/features/pronunciation/types';

const SAMPLE: PronunciationResult = {
  text: 'hello',
  language: 'en',
  ipa: 'həˈləʊ',
  audio: null,
  metadata: { engine: 'espeak-phonemes', engineVersion: '0.0.5', source: 'espeak' },
  phonemes: [
    { type: 'consonant', ipa: 'h', startMs: 0, endMs: 0 },
    { type: 'vowel', ipa: 'ə', startMs: 0, endMs: 0 },
    { type: 'stress', ipa: "'", startMs: 0, endMs: 0 },
    { type: 'consonant', ipa: 'l', startMs: 0, endMs: 0 },
    { type: 'diphthong', ipa: 'əʊ', startMs: 0, endMs: 0 },
  ],
};

export const showcaseMeta = {
  title: 'Pronunciation Panel',
  category: 'Features',
  level: 'feature' as const,
  description: 'Pronunciation phoneme list with eSpeak audio fallback.',
};

export default function PronunciationShowcase() {
  const [error, setError] = useState<string | null>(null);

  const playWord = useCallback(async () => {
    try {
      setError(null);
      await playEspeakWord('hello');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'eSpeak playback failed');
    }
  }, []);

  const playPhoneme = useCallback(async (phoneme: Phoneme) => {
    try {
      setError(null);
      await playEspeakPhoneme({
        ...phoneme,
        startMs: 0,
        endMs: 0,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'eSpeak phoneme playback failed');
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button type="button" onClick={playWord}>
        Play eSpeak word
      </button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <PronunciationPanel
        pronunciation={SAMPLE}
        audioSource="espeak"
        onPlayPhoneme={playPhoneme}
      />
    </div>
  );
}
