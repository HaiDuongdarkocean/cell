import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ComponentType,
  ReviewJudgment,
  SrsAudioAsset,
  SrsImageAsset,
  SrsNote,
  SrsReviewSession,
  SrsStimulus,
  SrsStudyConfig,
} from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { putCard } from '@/features/srs/repositories/cardRepository';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { deleteCardCascade } from '@/features/srs/repositories/deleteCascade';
import { putReviewEvent } from '@/features/srs/repositories/reviewEventRepository';
import { getStudyConfig } from '@/features/srs/repositories/studyConfigRepository';
import { selectNextReview } from '@/features/srs/logic/selectNextReview';
import { applyReview, resetCard, resetComponent, studyAgain } from '@/features/srs/logic/reviewEngine';
import { getSrsStats, type SrsDeckStats } from '@/features/srs/services/getSrsStats';
import { getSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';

function applyUiPrefs(cfg: SrsStudyConfig): { config: SrsStudyConfig; options: { shuffle: boolean; startWith: 'reviews' | 'new' }; includeSubdecks: boolean } {
  const prefs = getSrsUiPrefs();
  return {
    config: prefs.graduatePasses === null
      ? cfg
      : { ...cfg, learningPath: { ...cfg.learningPath, minExplores: prefs.graduatePasses } },
    options: { shuffle: prefs.shuffleReviews, startWith: prefs.startWith },
    includeSubdecks: true,
  };
}

interface SrsStudyContextValue {
  readonly ready: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly session: SrsReviewSession | null;
  readonly finished: boolean;
  readonly deckId: string | null;
  readonly stats: SrsDeckStats | null;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
  readonly start: (deckId?: string) => Promise<void>;
  readonly submit: (judgment: ReviewJudgment, typedInput?: string) => Promise<void>;
  readonly markStudyAgain: (componentType: ComponentType) => Promise<void>;
  readonly resetCurrentComponent: () => Promise<void>;
  readonly resetCurrentCard: () => Promise<void>;
  readonly endSession: () => void;
  readonly updateCurrentNote: (note: SrsNote, deckId?: string) => Promise<void>;
  readonly deleteCurrentCard: () => Promise<void>;
  readonly dismissError: () => void;
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
  const [stats, setStats] = useState<SrsDeckStats | null>(null);
  const [audioCache] = useState(() => new Map<string, SrsAudioAsset>());
  const [imageCache] = useState(() => new Map<string, SrsImageAsset>());

  const stimulus = session?.stimulus ?? null;
  useEffect(() => {
    const toRevoke = blobUrlsToRevoke(stimulus);
    return () => {
      for (const url of toRevoke) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore invalid or already revoked URLs
        }
      }
    };
  }, [stimulus]);

  const ensureDeck = useCallback(async () => {
    if (deckId && config && stats) return { deckId, config, stats };
    const result = await ensureFirstRun();
    const studyConfig = await getStudyConfig(result.studyConfigId);
    const deckStats = await getSrsStats(result.deckId);
    setDeckId(result.deckId);
    setConfig(studyConfig);
    setStats(deckStats);
    setReady(true);
    return { deckId: result.deckId, config: studyConfig, stats: deckStats };
  }, [deckId, config, stats]);

  const refreshStats = useCallback(async () => {
    if (!deckId) return;
    try {
      const nextStats = await getSrsStats(deckId);
      setStats(nextStats);
    } catch {
      // ignore transient stats refresh errors
    }
  }, [deckId]);

  const start = useCallback(async (deckIdOverride?: string) => {
    setLoading(true);
    setError(null);
    setFinished(false);
    try {
      const { deckId: defaultDeckId, config: cfg } = await ensureDeck();
      if (!cfg || !defaultDeckId) return;
      const did = deckIdOverride ?? defaultDeckId;
      if (did !== deckId) setDeckId(did);
      const { config: effConfig, options, includeSubdecks } = applyUiPrefs(cfg);
      const next = await selectNextReview(did, includeSubdecks, effConfig, nowISO(), adapter, audioCache, imageCache, 1000, options);
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
  }, [ensureDeck, deckId, audioCache, imageCache]);

  const submit = useCallback(
    async (judgment: ReviewJudgment, typedInput?: string) => {
      if (!session || !config) return;
      setLoading(true);
      setError(null);
      try {
        const result = applyReview(session, judgment, typedInput, new Date(nowISO()), config, adapter);
        await putCard(result.card);
        await putReviewEvent(result.record);
        void refreshStats();
        const { options, includeSubdecks } = applyUiPrefs(config);
        const next = await selectNextReview(
          session.card.deckId,
          includeSubdecks,
          config,
          nowISO(),
          adapter,
          audioCache,
          imageCache,
          1000,
          options,
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
    [session, config, audioCache, imageCache, refreshStats],
  );

  const markStudyAgain = useCallback(
    async (componentType: ComponentType) => {
      if (!session || !config) return;
      const updated = studyAgain(session.card, componentType, nowISO(), config, adapter);
      await putCard(updated);
      void refreshStats();
      setSession({ ...session, card: updated });
    },
    [session, config, refreshStats],
  );

  const resetCurrentComponent = useCallback(async () => {
    if (!session || !config) return;
    const updated = resetComponent(session.card, session.componentType, nowISO(), config, adapter);
    await putCard(updated);
    void refreshStats();
    setSession({ ...session, card: updated });
  }, [session, config, refreshStats]);

  const resetCurrentCard = useCallback(async () => {
    if (!session || !config) return;
    const updated = resetCard(session.card, nowISO(), config, adapter);
    await putCard(updated);
    void refreshStats();
    setSession({ ...session, card: updated });
  }, [session, config, refreshStats]);

  const endSession = useCallback(() => {
    setSession(null);
    setFinished(false);
    void refreshStats();
  }, [refreshStats]);

  const updateCurrentNote = useCallback(
    async (note: SrsNote, nextDeckId?: string) => {
      if (!session) return;
      const deckChanged = nextDeckId !== undefined && nextDeckId !== note.deckId;
      const nextNote = deckChanged ? { ...note, deckId: nextDeckId } : note;
      await putNote(nextNote);
      let nextCard = session.card;
      if (deckChanged) {
        nextCard = { ...session.card, deckId: nextDeckId };
        await putCard(nextCard);
      }
      void refreshStats();
      setSession({ ...session, note: nextNote, card: nextCard });
    },
    [session, refreshStats],
  );

  const deleteCurrentCard = useCallback(async () => {
    if (!session || !config) return;
    const deckIdOfCard = session.card.deckId;
    await deleteCardCascade(session.card.id);
    void refreshStats();
    const { options, includeSubdecks } = applyUiPrefs(config);
    const next = await selectNextReview(deckIdOfCard, includeSubdecks, config, nowISO(), adapter, audioCache, imageCache, 1000, options);
    if (next) {
      setSession(next);
    } else {
      setSession(null);
      setFinished(true);
    }
  }, [session, config, refreshStats, audioCache, imageCache]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const value: SrsStudyContextValue = useMemo(
    () => ({
      ready,
      loading,
      error,
      session,
      finished,
      deckId,
      stats,
      audioCache,
      imageCache,
      start,
      submit,
      markStudyAgain,
      resetCurrentComponent,
      resetCurrentCard,
      endSession,
      updateCurrentNote,
      deleteCurrentCard,
      dismissError,
    }),
    [
      ready,
      loading,
      error,
      session,
      finished,
      deckId,
      stats,
      audioCache,
      imageCache,
      start,
      submit,
      markStudyAgain,
      resetCurrentComponent,
      resetCurrentCard,
      endSession,
      updateCurrentNote,
      deleteCurrentCard,
      dismissError,
    ],
  );

  return <SrsStudyContext.Provider value={value}>{children}</SrsStudyContext.Provider>;
}

export function useSrsStudy(): SrsStudyContextValue {
  const ctx = useContext(SrsStudyContext);
  if (!ctx) throw new Error('useSrsStudy must be used inside SrsStudyProvider');
  return ctx;
}
