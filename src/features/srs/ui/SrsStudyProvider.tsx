import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ComponentType,
  ReviewJudgment,
  SrsAudioAsset,
  SrsImageAsset,
  SrsReviewSession,
  SrsStimulus,
  SrsStudyConfig,
} from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { putCard } from '@/features/srs/repositories/cardRepository';
import { putReviewEvent } from '@/features/srs/repositories/reviewEventRepository';
import { getStudyConfig } from '@/features/srs/repositories/studyConfigRepository';
import { selectNextReview } from '@/features/srs/logic/selectNextReview';
import { applyReview, resetCard, resetComponent, studyAgain } from '@/features/srs/logic/reviewEngine';

interface SrsStudyContextValue {
  readonly ready: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly session: SrsReviewSession | null;
  readonly finished: boolean;
  readonly deckId: string | null;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
  readonly start: () => Promise<void>;
  readonly submit: (judgment: ReviewJudgment, typedInput?: string) => Promise<void>;
  readonly markStudyAgain: (componentType: ComponentType) => Promise<void>;
  readonly resetCurrentComponent: () => Promise<void>;
  readonly resetCurrentCard: () => Promise<void>;
}

const SrsStudyContext = createContext<SrsStudyContextValue | null>(null);

const adapter = createSrsFsrsAdapter();

function nowISO(): string {
  return new Date().toISOString();
}

function blobUrlsToRevoke(stimulus: SrsStimulus | null): string[] {
  if (!stimulus) return [];
  const urls: string[] = [];
  for (const v of Object.values(stimulus.payload)) {
    if ((v.kind === 'audio' || v.kind === 'image') && typeof v.value === 'string' && v.value.startsWith('blob:')) {
      urls.push(v.value);
    }
  }
  return urls;
}

export function SrsStudyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SrsReviewSession | null>(null);
  const [finished, setFinished] = useState(false);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [config, setConfig] = useState<SrsStudyConfig | null>(null);
  const [audioCache] = useState(() => new Map<string, SrsAudioAsset>());
  const [imageCache] = useState(() => new Map<string, SrsImageAsset>());

  useEffect(() => {
    const toRevoke = blobUrlsToRevoke(session?.stimulus ?? null);
    return () => {
      for (const url of toRevoke) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore invalid or already revoked URLs
        }
      }
    };
  }, [session]);

  const ensureDeck = useCallback(async () => {
    if (deckId && config) return { deckId, config };
    const result = await ensureFirstRun();
    const studyConfig = await getStudyConfig(result.studyConfigId);
    setDeckId(result.deckId);
    setConfig(studyConfig);
    setReady(true);
    return { deckId: result.deckId, config: studyConfig };
  }, [deckId, config]);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFinished(false);
    try {
      const { deckId: did, config: cfg } = await ensureDeck();
      if (!cfg || !did) return;
      const next = await selectNextReview(did, false, cfg, nowISO(), adapter, audioCache, imageCache);
      if (next) {
        setSession(next);
      } else {
        setSession(null);
        setFinished(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ensureDeck, audioCache, imageCache]);

  const submit = useCallback(
    async (judgment: ReviewJudgment, typedInput?: string) => {
      if (!session || !config) return;
      setLoading(true);
      setError(null);
      try {
        const result = applyReview(session, judgment, typedInput, new Date(nowISO()), config, adapter);
        await putCard(result.card);
        await putReviewEvent(result.record);
        const next = await selectNextReview(
          session.card.deckId,
          false,
          config,
          nowISO(),
          adapter,
          audioCache,
          imageCache,
        );
        if (next) {
          setSession(next);
        } else {
          setSession(null);
          setFinished(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [session, config, audioCache, imageCache],
  );

  const markStudyAgain = useCallback(
    async (componentType: ComponentType) => {
      if (!session || !config) return;
      const updated = studyAgain(session.card, componentType, nowISO(), config, adapter);
      await putCard(updated);
      setSession({ ...session, card: updated });
    },
    [session, config],
  );

  const resetCurrentComponent = useCallback(async () => {
    if (!session || !config) return;
    const updated = resetComponent(session.card, session.componentType, nowISO(), config, adapter);
    await putCard(updated);
    setSession({ ...session, card: updated });
  }, [session, config]);

  const resetCurrentCard = useCallback(async () => {
    if (!session || !config) return;
    const updated = resetCard(session.card, nowISO(), config, adapter);
    await putCard(updated);
    setSession({ ...session, card: updated });
  }, [session, config]);

  const value: SrsStudyContextValue = useMemo(
    () => ({
      ready,
      loading,
      error,
      session,
      finished,
      deckId,
      audioCache,
      imageCache,
      start,
      submit,
      markStudyAgain,
      resetCurrentComponent,
      resetCurrentCard,
    }),
    [
      ready,
      loading,
      error,
      session,
      finished,
      deckId,
      audioCache,
      imageCache,
      start,
      submit,
      markStudyAgain,
      resetCurrentComponent,
      resetCurrentCard,
    ],
  );

  return <SrsStudyContext.Provider value={value}>{children}</SrsStudyContext.Provider>;
}

export function useSrsStudy(): SrsStudyContextValue {
  const ctx = useContext(SrsStudyContext);
  if (!ctx) throw new Error('useSrsStudy must be used inside SrsStudyProvider');
  return ctx;
}
