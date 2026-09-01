import { useEffect, useState } from 'react';
import { pronunciationEngine } from '../services/pronunciationEngineSingleton';
import type { PronunciationEngine } from '../services/pronunciationEngine';
import type { PronunciationResult } from '../types';

export interface UsePronunciationOptions {
  /** Word or short phrase to look up. */
  readonly term: string;
  /** BCP-47 / ISO language code. */
  readonly langCode: string;
  /** When false, the engine is not called and the result stays null. Default true. */
  readonly enabled?: boolean;
  /** Optional engine for dependency injection / tests. Defaults to the shared singleton. */
  readonly engine?: PronunciationEngine;
}

export interface UsePronunciationReturn {
  readonly pronunciation: PronunciationResult | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Hook that resolves a term to a structured pronunciation result.
 *
 * The eSpeak phoneme engine is loaded lazily on first use; the result is
 * recomputed whenever the term or language changes.
 */
export function usePronunciation(options: UsePronunciationOptions): UsePronunciationReturn {
  const { term, langCode, enabled = true, engine = pronunciationEngine } = options;
  const [pronunciation, setPronunciation] = useState<PronunciationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPronunciation(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    void (async (): Promise<void> => {
      if (!term) {
        setPronunciation(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await engine.toPronunciation(term, langCode);
        if (!cancelled) setPronunciation(result);
      } catch (err: unknown) {
        if (!cancelled) {
          setPronunciation(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [term, langCode, enabled, engine]);

  return { pronunciation, loading, error };
}
