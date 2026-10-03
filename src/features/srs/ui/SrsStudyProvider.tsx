import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  ResolvedVariantToggles,
  ReviewJudgment,
  SrsAudioAsset,
  SrsImageAsset,
  SrsNote,
  SrsReviewSession,
  SrsStimulus,
  SrsStudyConfig,
  SrsVariant,
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
import { isVariantServable, resolveVariantToggles } from '@/features/srs/lib/variantFront';
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
  readonly submit: (judgment: ReviewJudgment, typedInput?: string, toggles?: ResolvedVariantToggles) => Promise<void>;
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

function mergeNoteFields(prev: SrsNote, next: SrsNote): SrsNote {
  if (prev.id !== next.id) return next;
  let fields = next.fields;
  for (const [id, v] of Object.entries(next.fields)) {
    const old = prev.fields[id];
    if (old !== undefined && old !== v && JSON.stringify(old) === JSON.stringify(v)) {
      if (fields === next.fields) fields = { ...next.fields };
      fields[id] = old;
    }
  }
  return fields === next.fields ? next : { ...next, fields };
}

function mergeStimulusPayload(prev: SrsStimulus, next: SrsStimulus): SrsStimulus {
  let payload = next.payload;
  for (const [id, v] of Object.entries(next.payload)) {
    const old = prev.payload[id];
    if (old !== undefined && old !== v && JSON.stringify(old) === JSON.stringify(v)) {
      if (payload === next.payload) payload = { ...next.payload };
      payload[id] = old;
    }
  }
  return payload === next.payload && next.type === prev.type ? prev : { ...next, payload };
}

function keepToggles(prev: ResolvedVariantToggles, next: ResolvedVariantToggles): ResolvedVariantToggles {
  return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
}

interface Resurfaced {
  readonly variant: SrsVariant;
  readonly stimulus: SrsStimulus;
  readonly toggles: ResolvedVariantToggles;
}

function resurfaceSession(
  session: SrsReviewSession,
  note: SrsNote,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): Resurfaced | null {
  const prefs = getSrsUiPrefs().variantToggles;
  const ordered = [session.variant, ...session.variants.filter((v) => v.id !== session.variant.id)];
  for (const variant of ordered) {
    if (!isVariantServable(variant, note, session.notetype)) continue;
    const built = buildVariantStimulus(note, variant, audioCache, imageCache);
    if (!built || !isVariantServable(variant, built.resolvedNote, session.notetype)) continue;
    const sameVariant = variant.id === session.variant.id;
    return {
      variant,
      stimulus: sameVariant ? mergeStimulusPayload(session.stimulus, built.stimulus) : built.stimulus,
      toggles: sameVariant
        ? keepToggles(session.toggles, resolveVariantToggles(variant, built.resolvedNote, prefs[variant.id]))
        : resolveVariantToggles(variant, built.resolvedNote, prefs[variant.id]),
    };
  }
  return null;
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

  const advanceToNext = useCallback(
    async (current: SrsReviewSession, recordHistory: boolean) => {
      if (!config) return;
      const { options, includeSubdecks } = applyUiPrefs(config);
      const next = await selectNextReview(
        sessionCollectionId ? null : current.card.deckId,
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
        if (recordHistory) setHistory((h) => [...h, current]);
        if (next.card.deckId !== current.card.deckId) setDeckId(next.card.deckId);
        setSession(next);
      } else {
        setSession(null);
        setFinished(true);
        setHistory([]);
        revokeAllBlobUrls();
      }
    },
    [config, sessionCollectionId, audioCache, imageCache, revokeAllBlobUrls],
  );

  const submit = useCallback(
    async (judgment: ReviewJudgment, typedInput?: string, toggles?: ResolvedVariantToggles) => {
      if (!session || !config) return;
      setLoading(true);
      setError(null);
      try {
        const graded = toggles && toggles !== session.toggles ? { ...session, toggles } : session;
        const result = applyReview(graded, judgment, typedInput, new Date(nowISO()), config, adapter);
        await putCard(result.card);
        await putReviewEvent(result.record);
        void sendMessage({
          type: MESSAGE_TYPES.ANKI_STATUS_SRS_REVIEWED,
          payload: { noteId: session.note.id, cardId: result.card.id },
        }).catch(() => {});
        void refreshStats();
        await advanceToNext(session, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [session, config, refreshStats, advanceToNext],
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
      if (nextNote.id !== session.note.id) return;
      const mergedNote = mergeNoteFields(session.note, nextNote);
      if (stimulusStale(session, mergedNote) || !isVariantServable(session.variant, mergedNote, session.notetype)) {
        const surface = resurfaceSession(session, mergedNote, audioCache, imageCache);
        if (!surface) {
          await advanceToNext(session, false);
          return;
        }
        setSession({
          ...session,
          note: mergedNote,
          card: nextCard,
          variant: surface.variant,
          stimulus: surface.stimulus,
          toggles: surface.toggles,
        });
        return;
      }
      setSession({ ...session, note: mergedNote, card: nextCard });
    },
    [session, refreshStats, audioCache, imageCache, advanceToNext],
  );

  const previewCurrentNote = useCallback(
    (note: SrsNote, assets?: { audio?: SrsAudioAsset[]; image?: SrsImageAsset[] }) => {
      if (!session || note.id !== session.note.id) return;
      for (const a of assets?.audio ?? []) audioCache.set(audioAssetId(note.id, a.fieldId, a.source, a.index ?? 0), a);
      for (const a of assets?.image ?? []) imageCache.set(imageAssetId(note.id, a.fieldId, a.index ?? 0), a);
      const mergedNote = mergeNoteFields(session.note, note);
      if (stimulusStale(session, mergedNote) || !isVariantServable(session.variant, mergedNote, session.notetype)) {
        const surface = resurfaceSession(session, mergedNote, audioCache, imageCache);
        if (!surface) return;
        setSession({
          ...session,
          note: mergedNote,
          variant: surface.variant,
          stimulus: surface.stimulus,
          toggles: surface.toggles,
        });
        return;
      }
      setSession({ ...session, note: mergedNote });
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
