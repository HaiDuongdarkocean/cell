// useAiAsk — per-popup AI ask state machine (spec ai-bridge-dictionary REQ-1/8/9).
//
// One in-flight ask per popup; retry re-issues the same feature context.
// Provider resolution + failover chain live in the background handler — the
// hook only sees the terminal result plus the provider that answered.

import { useCallback, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message/types';
import type { AiFeature, AiProviderId } from '@/entities/settings';
import { aiAnswerCacheKey, getAiAnswer, setAiAnswer } from '@/features/aiBridge';

export type { AiFeature, AiProviderId } from '@/entities/settings';

export interface AiAnswer {
  readonly feature: AiFeature;
  readonly text: string;
  readonly provider: AiProviderId;
}

export type AiAskPhase = 'idle' | 'loading' | 'answered' | 'error';

export interface AiAskState {
  readonly phase: AiAskPhase;
  /** The feature this state describes (idle before any ask). */
  readonly feature: AiFeature | null;
  readonly answer: AiAnswer | null;
  /** Provider currently being asked (or last asked). */
  readonly provider: AiProviderId | null;
  /** Failover notice: a provider failed and the chain moved on. */
  readonly failoverFrom: AiProviderId | null;
  readonly error: string | null;
}

interface AiAskResponseData {
  readonly text?: string;
  readonly provider?: AiProviderId;
  readonly attempts?: readonly { provider: AiProviderId; error: string }[];
}

const IDLE: AiAskState = {
  phase: 'idle',
  feature: null,
  answer: null,
  provider: null,
  failoverFrom: null,
  error: null,
};

/** The single in-flight state only describes the feature it was last asked
 *  for — derive a per-feature view for panels so a cached answer or a clean
 *  idle state shows for the other feature. */
export function aiStateForFeature(
  state: AiAskState,
  answers: readonly AiAnswer[],
  feature: AiFeature,
): AiAskState {
  if (state.feature === feature) return state;
  const cached = answers.find((a) => a.feature === feature);
  if (cached) {
    return { phase: 'answered', feature, answer: cached, provider: cached.provider, failoverFrom: null, error: null };
  }
  return { ...IDLE, feature };
}

export function useAiAsk(): {
  readonly state: AiAskState;
  /** All answered features this session — feeds the card note append. */
  readonly answers: readonly AiAnswer[];
  /** `fresh` bypasses the tab-session cache (retry/regenerate). */
  readonly ask: (feature: AiFeature, prompt: string, provider?: AiProviderId, fresh?: boolean) => Promise<AiAnswer | null>;
  readonly retry: (prompt: string) => Promise<AiAnswer | null>;
  readonly reset: () => void;
} {
  const [state, setState] = useState<AiAskState>(IDLE);
  const [answers, setAnswers] = useState<readonly AiAnswer[]>([]);
  const lastAskRef = useRef<{ feature: AiFeature; provider?: AiProviderId } | null>(null);
  const inFlightRef = useRef(false);

  const ask = useCallback(
    async (feature: AiFeature, prompt: string, provider?: AiProviderId, fresh = false): Promise<AiAnswer | null> => {
      if (inFlightRef.current || !prompt.trim()) return null;
      const cacheKey = aiAnswerCacheKey(feature, provider, prompt);
      const cached = fresh ? undefined : getAiAnswer(cacheKey);
      if (cached) {
        lastAskRef.current = { feature, provider };
        const answer: AiAnswer = { feature, text: cached.text, provider: cached.provider };
        setAnswers((prev) => [...prev.filter((a) => a.feature !== feature), answer]);
        setState({
          phase: 'answered',
          feature,
          answer,
          provider: answer.provider,
          failoverFrom: null,
          error: null,
        });
        return answer;
      }
      inFlightRef.current = true;
      lastAskRef.current = { feature, provider };
      setState((prev) => ({
        phase: 'loading',
        feature,
        answer: prev.feature === feature ? prev.answer : null,
        provider: provider ?? prev.provider,
        failoverFrom: null,
        error: null,
      }));
      try {
        const res = await sendMessage<MessageResponse<AiAskResponseData>>({
          type: MESSAGE_TYPES.AI_ASK,
          payload: { prompt, provider, feature },
        });
        const text = res?.data?.text?.trim();
        if (res?.success && text) {
          const answer: AiAnswer = {
            feature,
            text,
            provider: res.data?.provider ?? provider ?? 'chatgpt',
          };
          const failedAttempt = res.data?.attempts?.find((a) => a.provider !== answer.provider);
          setAiAnswer(cacheKey, answer);
          setAnswers((prev) => [...prev.filter((a) => a.feature !== feature), answer]);
          setState({
            phase: 'answered',
            feature,
            answer,
            provider: answer.provider,
            failoverFrom: failedAttempt?.provider ?? null,
            error: null,
          });
          return answer;
        }
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: res?.error ?? 'no response',
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        inFlightRef.current = false;
      }
      return null;
    },
    [],
  );

  const retry = useCallback(
    async (prompt: string): Promise<AiAnswer | null> => {
      const last = lastAskRef.current;
      if (!last) return null;
      return ask(last.feature, prompt, last.provider, true);
    },
    [ask],
  );

  const reset = useCallback((): void => {
    setState(IDLE);
    setAnswers([]);
    lastAskRef.current = null;
  }, []);

  return { state, answers, ask, retry, reset };
}
