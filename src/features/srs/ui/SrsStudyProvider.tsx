import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
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
import { selectNextReview, type SelectNextReviewOptions } from '@/features/srs/logic/selectNextReview';
import { applyReview, resetCard, resetComponent, studyAgain } from '@/features/srs/logic/reviewEngine';
import { getSrsStats, type SrsDeckStats } from '@/features/srs/services/getSrsStats';
import { buildVariantStimulus } from '@/features/srs/logic/resolveReviewSurface';
import { resolveVariantToggles } from '@/features/srs/lib/variantFront';
import { audioAssetId, imageAssetId, mediaFieldValues } from '@/features/srs/lib/helpers';
import { getSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';

function applyUiPrefs(cfg: SrsStudyConfig): { config: SrsStudyConfig; options: SelectNextReviewOptions; includeSubdecks: boolean } {
  const prefs = getSrsUiPrefs();
  return {
    config: cfg,
    options: {
      shuffle: prefs.shuffleReviews,
      startWith: prefs.startWith,
      variantToggles: prefs.variantToggles,
      newLoopsOverride: prefs.graduatePasses ?? undefined,
    },
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
  readonly canGoBack: boolean;
  readonly goBack: () => void;
  readonly start: (deckId?: string) => Promise<void>;
  readonly submit: (judgment: ReviewJudgment, typedInput?: string) => Promise<void>;
  readonly markStudyAgain: (variantId: string) => Promise<void>;
  readonly resetCurrentComponent: () => Promise<void>;
  readonly resetCurrentCard: () => Promise<void>;
  readonly endSession: () => void;
  readonly updateCurrentNote: (note: SrsNote, deckId?: string) => Promise<void>;
  readonly previewCurrentNote: (note: SrsNote, assets?: { audio?: SrsAudioAsset[]; image?: SrsImageAsset[] }) => void;
  readonly deleteCurrentCard: () => Promise<void>;
  readonly dismissError: () => void;
}

const SrsStudyContext = createContext<SrsStudyContextValue | null>(null);

const adapter = createSrsFsrsAdapter();

function nowISO(): string {
  return new Date().toISOString();
}

function stimulusStale(session: SrsReviewSession, nextNote: SrsNote): boolean {
  if (session.note.targetWord !== nextNote.targetWord) return true;
  return Object.keys(session.stimulus.payload).some(
    (id) => JSON.stringify(session.note.fields[id] ?? null) !== JSON.stringify(nextNote.fields[id] ?? null),
  );
}

function blobUrlsToRevoke(stimulus: SrsStimulus | null): string[] {
  if (!stimulus) return [];
  const urls: string[] = [];
  for (const v of Object.values(stimulus.payload)) {
    if (v.kind !== 'audio' && v.kind !== 'image') continue;
    for (const item of mediaFieldValues(v)) {
      if (item.startsWith('blob:')) urls.push(item);
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
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [sessionCollectionId, setSessionCollectionId] = useState<string | null>(null);
  const [config, setConfig] = useState<SrsStudyConfig | null>(null);
  const [stats, setStats] = useState<SrsDeckStats | null>(null);
  const [audioCache] = useState(() => new Map<string, SrsAudioAsset>());
  const [imageCache] = useState(() => new Map<string, SrsImageAsset>());

  const [history, setHistory] = useState<readonly SrsReviewSession[]>([]);
  const liveBlobUrls = useRef(new Set<string>());

  const stimulus = session?.stimulus ?? null;
  useEffect(() => {
    for (const url of blobUrlsToRevoke(stimulus)) {
      liveBlobUrls.current.add(url);
    }
  }, [stimulus]);

  const revokeAllBlobUrls = useCallback(() => {
    for (const url of liveBlobUrls.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore invalid or already revoked URLs
      }
    }
    liveBlobUrls.current.clear();
  }, []);

  useEffect(() => revokeAllBlobUrls, [revokeAllBlobUrls]);

  const goBack = useCallback(() => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setSession(prev);
    setFinished(false);
  }, [history]);

  const ensureDeck = useCallback(async () => {
    if (deckId && config && stats && collectionId) return { collectionId, deckId, config, stats };
    const result = await ensureFirstRun();
    const studyConfig = await getStudyConfig(result.studyConfigId);
    const deckStats = await getSrsStats(result.deckId);
    setCollectionId(result.collectionId);
    setDeckId(result.deckId);
    setConfig(studyConfig);
    setStats(deckStats);
    setReady(true);
    return { collectionId: result.collectionId, deckId: result.deckId, config: studyConfig, stats: deckStats };
  }, [deckId, collectionId, config, stats]);

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
    setHistory([]);
    revokeAllBlobUrls();
    try {
      const { collectionId: colId, deckId: defaultDeckId, config: cfg } = await ensureDeck();
      if (!cfg || !defaultDeckId) return;
      const { config: effConfig, options, includeSubdecks } = applyUiPrefs(cfg);
      const scopeId = deckIdOverride ?? null;
      const next = await selectNextReview(scopeId, includeSubdecks, effConfig, nowISO(), adapter, audioCache, imageCache, 1000, options, scopeId ? undefined : colId);
      setSessionCollectionId(scopeId ? null : colId);
      if (next) {
        if (next.card.deckId !== deckId) setDeckId(next.card.deckId);
        setSession(next);
      } else {
        if (scopeId && scopeId !== deckId) setDeckId(scopeId);
        setSession(null);
        setFinished(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ensureDeck, deckId, audioCache, imageCache, revokeAllBlobUrls]);

  const submit = useCallback(
    async (judgment: ReviewJudgment, typedInput?: string) => {
      if (!session || !config) return;
      setLoading(true);
      setError(null);
      try {
        const result = applyReview(session, judgment, typedInput, new Date(nowISO()), config, adapter);
        await putCard(result.card);
        await putReviewEvent(result.record);
        void sendMessage({
          type: MESSAGE_TYPES.ANKI_STATUS_SRS_REVIEWED,
          payload: { noteId: session.note.id, cardId: result.card.id },
        }).catch(() => {});
        void refreshStats();
        const { options, includeSubdecks } = applyUiPrefs(config);
        const next = await selectNextReview(
          sessionCollectionId ? null : session.card.deckId,
          includeSubdecks,
          config,
          nowISO(),
          adapter,
          audioCache,
          imageCache,
          1000,
          options,
          sessionCollectionId ?? undefined,
        );
        if (next) {
          setHistory((h) => [...h, session]);
          if (next.card.deckId !== session.card.deckId) setDeckId(next.card.deckId);
          setSession(next);
        } else {
          setSession(null);
          setFinished(true);
          setHistory([]);
          revokeAllBlobUrls();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [session, sessionCollectionId, config, audioCache, imageCache, refreshStats, revokeAllBlobUrls],
  );

  const markStudyAgain = useCallback(
    async (variantId: string) => {
      if (!session || !config) return;
      const updated = studyAgain(session.card, variantId, session.note, session.notetype, session.variants, nowISO(), config, adapter);
      await putCard(updated);
      void refreshStats();
      setSession({ ...session, card: updated });
    },
    [session, config, refreshStats],
  );

  const resetCurrentComponent = useCallback(async () => {
    if (!session || !config) return;
    const updated = resetComponent(session.card, session.variant.id, session.note, session.notetype, session.variants, nowISO(), config, adapter);
    await putCard(updated);
    void refreshStats();
    setSession({ ...session, card: updated });
  }, [session, config, refreshStats]);

  const resetCurrentCard = useCallback(async () => {
    if (!session || !config) return;
    const updated = resetCard(session.card, session.note, session.notetype, session.variants, nowISO(), config, adapter);
    await putCard(updated);
    void refreshStats();
    setSession({ ...session, card: updated });
  }, [session, config, refreshStats]);

  const endSession = useCallback(() => {
    setSession(null);
    setFinished(false);
    setHistory([]);
    setSessionCollectionId(null);
    revokeAllBlobUrls();
    void refreshStats();
  }, [refreshStats, revokeAllBlobUrls]);

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
      const built = stimulusStale(session, nextNote)
        ? buildVariantStimulus(nextNote, session.variant, audioCache, imageCache)
        : null;
      setSession({
        ...session,
        note: nextNote,
        card: nextCard,
        stimulus: built?.stimulus ?? session.stimulus,
        toggles: built
          ? resolveVariantToggles(session.variant, built.resolvedNote, getSrsUiPrefs().variantToggles[session.variant.id])
          : session.toggles,
      });
    },
    [session, refreshStats, audioCache, imageCache],
  );

  const previewCurrentNote = useCallback(
    (note: SrsNote, assets?: { audio?: SrsAudioAsset[]; image?: SrsImageAsset[] }) => {
      if (!session) return;
      for (const a of assets?.audio ?? []) audioCache.set(audioAssetId(note.id, a.fieldId, a.source, a.index ?? 0), a);
      for (const a of assets?.image ?? []) imageCache.set(imageAssetId(note.id, a.fieldId, a.index ?? 0), a);
      const built = stimulusStale(session, note)
        ? buildVariantStimulus(note, session.variant, audioCache, imageCache)
        : null;
      setSession({
        ...session,
        note,
        stimulus: built?.stimulus ?? session.stimulus,
        toggles: built
          ? resolveVariantToggles(session.variant, built.resolvedNote, getSrsUiPrefs().variantToggles[session.variant.id])
          : session.toggles,
      });
    },
    [session, audioCache, imageCache],
  );

  const deleteCurrentCard = useCallback(async () => {
    if (!session || !config) return;
    const deckIdOfCard = session.card.deckId;
    await deleteCardCascade(session.card.id);
    void refreshStats();
    const { options, includeSubdecks } = applyUiPrefs(config);
    const next = await selectNextReview(sessionCollectionId ? null : deckIdOfCard, includeSubdecks, config, nowISO(), adapter, audioCache, imageCache, 1000, options, sessionCollectionId ?? undefined);
    if (next) {
      if (next.card.deckId !== deckIdOfCard) setDeckId(next.card.deckId);
      setSession(next);
    } else {
      setSession(null);
      setFinished(true);
      setHistory([]);
      revokeAllBlobUrls();
    }
  }, [session, sessionCollectionId, config, refreshStats, audioCache, imageCache, revokeAllBlobUrls]);

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
      canGoBack: history.length > 0,
      goBack,
      start,
      submit,
      markStudyAgain,
      resetCurrentComponent,
      resetCurrentCard,
      endSession,
      updateCurrentNote,
      previewCurrentNote,
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
      history,
      goBack,
      start,
      submit,
      markStudyAgain,
      resetCurrentComponent,
      resetCurrentCard,
      endSession,
      updateCurrentNote,
      previewCurrentNote,
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
