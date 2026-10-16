// useAiAsk — per-popup AI ask state machine (spec ai-bridge-dictionary REQ-1/8/9).
//
// One in-flight ask per popup; retry re-issues the same feature context.
// Provider resolution + failover chain live in the background handler — the
// hook only sees the terminal result plus the provider that answered.

import { useCallback, useRef, useState } from 'react';
import {
  onMessage,
  removeOnMessageListener,
  sendMessage,
} from '@/shared/lib/chrome-apis/runtime';
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
  /** Providers that refused for missing login — shown so the user can sign in. */
  readonly loginProviders: readonly AiProviderId[];
  readonly error: string | null;
}

interface AiAskResponseData {
  readonly text?: string;
  readonly provider?: AiProviderId;
  readonly attempts?: readonly { provider: AiProviderId; error: string }[];
}

/** Slightly above the provider-side 90s cap + chain overhead. */
const ASK_CLIENT_TIMEOUT_MS = 120_000;

const IDLE: AiAskState = {
  phase: 'idle',
  feature: null,
  answer: null,
  provider: null,
  failoverFrom: null,
  loginProviders: [],
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
    return { phase: 'answered', feature, answer: cached, provider: cached.provider, failoverFrom: null, loginProviders: [], error: null };
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
  /** Abandons the in-flight ask (provider keeps the page-side generation
   *  stopped via AI_CANCEL); stale resolutions no-op. */
  readonly cancel: () => void;
  readonly reset: () => void;
} {
  const [state, setState] = useState<AiAskState>(IDLE);
  const [answers, setAnswers] = useState<readonly AiAnswer[]>([]);
  const lastAskRef = useRef<{ feature: AiFeature; provider?: AiProviderId } | null>(null);
  const inFlightRef = useRef(false);
  /** Bumped on every ask/cancel/reset — stale resolutions no-op. */
  const generationRef = useRef(0);
  const streamListenerRef = useRef<((message: unknown) => void) | null>(null);

  const cancel = useCallback((): void => {
    generationRef.current += 1;
    inFlightRef.current = false;
    if (streamListenerRef.current) {
      removeOnMessageListener(streamListenerRef.current);
      streamListenerRef.current = null;
    }
    void sendMessage({ type: MESSAGE_TYPES.AI_CANCEL, payload: {} }).catch(() => {});
    setState((prev) => (prev.phase === 'loading' ? { ...prev, phase: 'idle', answer: null } : prev));
  }, []);

  const ask = useCallback(
    async (feature: AiFeature, prompt: string, provider?: AiProviderId, fresh = false): Promise<AiAnswer | null> => {
      if (inFlightRef.current) {
        // Same-feature re-ask (retry / provider pick) abandons the running
        // ask; a different feature keeps the single-slot serialization.
        if (lastAskRef.current?.feature !== feature) return null;
        cancel();
      }
      if (!prompt.trim()) return null;
      const gen = ++generationRef.current;
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
          loginProviders: [],
          error: null,
        });
        return answer;
      }
      inFlightRef.current = true;
      lastAskRef.current = { feature, provider };
      setState((prev) => ({
        phase: 'loading',
        feature,
        answer: null,
        provider: provider ?? prev.provider,
        failoverFrom: null,
        loginProviders: [],
        error: null,
      }));
      // Streamed partials carry our askId — render them as the answer grows;
      // the terminal AI_ASK response stays authoritative.
      const askId = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const onStream = (message: unknown): void => {
        if (gen !== generationRef.current) return;
        const msg = message as {
          type?: unknown;
          payload?: { askId?: unknown; provider?: unknown; text?: unknown };
        };
        if (msg?.type !== MESSAGE_TYPES.AI_STREAM || msg.payload?.askId !== askId) return;
        const text = typeof msg.payload.text === 'string' ? msg.payload.text.trim() : '';
        const streamProvider = msg.payload.provider as AiProviderId | undefined;
        if (!text || !streamProvider) return;
        setState((prev) =>
          prev.feature === feature && prev.phase === 'loading'
            ? { ...prev, answer: { feature, text, provider: streamProvider }, provider: streamProvider }
            : prev,
        );
      };
      streamListenerRef.current = onStream;
      onMessage(onStream);
      try {
        // Client-side hard cap: if the response is lost (SW reload orphaning
        // the sendMessage callback, provider chain stall), the popup must
        // surface an error — never spin "thinking" forever.
        const res = await Promise.race([
          sendMessage<MessageResponse<AiAskResponseData>>({
            type: MESSAGE_TYPES.AI_ASK,
            payload: { prompt, provider, feature, askId },
          }),
          new Promise<null>((r) => setTimeout(() => r(null), ASK_CLIENT_TIMEOUT_MS)),
        ]);
        if (gen !== generationRef.current) return null;
        if (res === null) {
          cancel();
          setState((prev) => ({
            ...prev,
            phase: 'error',
            loginProviders: [],
            error: 'timeout',
          }));
          return null;
        }
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
            loginProviders: [],
            error: null,
          });
          return answer;
        }
        setState((prev) => ({
          ...prev,
          phase: 'error',
          loginProviders:
            res?.data?.attempts
              ?.filter((a) => a.error === 'loginRequired')
              .map((a) => a.provider) ?? [],
          error: res?.error ?? 'no response',
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          loginProviders: [],
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        if (gen === generationRef.current) inFlightRef.current = false;
        if (streamListenerRef.current === onStream) streamListenerRef.current = null;
        removeOnMessageListener(onStream);
      }
      return null;
    },
    [cancel],
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
    cancel();
    setState(IDLE);
    setAnswers([]);
    lastAskRef.current = null;
  }, [cancel]);

  return { state, answers, ask, retry, cancel, reset };
}
