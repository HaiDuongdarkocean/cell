import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { ExternalDictLinkTemplate } from '@/entities/settings';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { nextStatus } from '@/features/dictionary';
import { setWordStatus } from '@/features/dictionary';
import { emitWordStatusChanged, aggregatePosStatus } from '@/features/dictionary';
import { toggleTrackingFlag } from '@/features/dictionary';
import { getSrsTermCardCount } from '@/features/srs';
import {
  initDefinitionSelection,
  initExampleSelection,
  getSelectedDefinitions,
  splitSelectionId,
  examplesForSelectionId,
} from '../logic/definitionSelection';
import { buildPrefill } from './buildCandidatePrefill';
import { useDictionaryToolbar } from '../logic/useDictionaryToolbar';
import type {
  LookupResult,
  DefinitionEntry,
  PopupTab,
  WordStatus,
  AudioItem,
  ImageItem,
  ExternalDictLink,
  PopupCardCreatorPrefill,
  PopupSelectionSnapshot,
  PosVariant,
  VariantFrequency,
} from '@/entities/dictionary';
import type { DefinitionSelection, ExampleSelection } from '../logic/definitionSelection';
import {
  formatAiNoteBlocks,
  mergeAiNoteBlocks,
  parseBreakdown,
  type BreakdownChunk,
} from '@/features/aiBridge';
import type { AiAnswer, AiAskState } from '../logic/useAiAsk';
import type { AiFeature, AiProviderId } from '@/entities/settings';
import { DEFAULT_AI_BRIDGE_SETTINGS } from '@/shared/config/config';

import { normalizeAccent } from '@/features/pronunciation';


export interface UseCandidateOptions {
  readonly candidate: LookupResult;
  readonly contextSentence: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  /** Live AI-note push after a send/quick-add: invoked whenever the answer set
   *  changes so an already-open card dialog can merge the late blocks. */
  readonly onAiNoteUpdate?: (answers: readonly AiAnswer[]) => void;
  /** Called when the user cycles the word status inside this candidate. */
  readonly onStatusChange?: (term: string, langCode: string, status: WordStatus) => void;
  /** Default media tab to open when this candidate first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /** Optional popup selection snapshot used to clone checked state. */
  readonly selectionSnapshot?: PopupSelectionSnapshot;
  /** Pre-loaded audio items for this candidate (popup clone). */
  readonly initialAudioItems?: readonly AudioItem[];
  /** Pre-loaded image items for this candidate (popup clone). */
  readonly initialImageItems?: readonly ImageItem[];
  /** Preload media/translation for the integrated panel. */
  readonly preloadMedia?: boolean;
}

export interface UseCandidateReturn {
  readonly status: WordStatus;
  readonly cycleStatus: () => void;
  readonly toggleTracking: () => void;
  readonly srsCardCount: number;
  readonly variant: PosVariant | undefined;
  readonly variantIndex: number;
  readonly selectVariant: (index: number) => void;
  readonly accentIndex: number;

  readonly displayReading: string;
  readonly displayDefinitions: readonly DefinitionEntry[];
  readonly displayFrequencies: readonly VariantFrequency[];
  readonly displayStars: { readonly count: number; readonly source: string } | undefined;
  readonly displayInflections: LookupResult['inflections'];
  readonly imageQueryTerm: string;
  readonly activeTab: PopupTab | null;
  readonly setActiveTab: (tab: PopupTab | null) => void;
  readonly definitionSelection: DefinitionSelection;
  readonly toggleDefinition: (id: string, selected: boolean) => void;
  readonly exampleSelection: ExampleSelection;
  readonly toggleExample: (defId: string, index: number, selected: boolean) => void;
  readonly selectedDefinitions: readonly DefinitionEntry[];
  readonly selectedDefinitionCount: number;
  readonly audioItems: readonly AudioItem[];
  readonly audioLoading: boolean;
  readonly audioError: string | null;
  readonly localAudioNeedsRegrant: boolean;
  readonly audioSelection: Map<string, boolean>;
  readonly toggleAudio: (id: string, selected: boolean) => void;
  readonly selectedAudioCount: number;
  readonly imageItems: readonly ImageItem[];
  readonly imageLoading: boolean;
  readonly imageError: string | null;
  readonly imageSelection: Map<string, boolean>;
  readonly toggleImage: (id: string, selected: boolean) => void;
  readonly removeImageItem: (id: string) => void;
  readonly selectedImageCount: number;
  readonly links: readonly ExternalDictLink[];
  readonly selectedLinkCount: number;
  readonly translation: string;
  readonly isTranslating: boolean;
  readonly translationError: string | null;
  readonly translationSelected: boolean;
  readonly toggleTranslation: () => void;
  readonly translate: (fresh?: boolean) => Promise<string>;
  readonly selectedTranslationCount: number;
  readonly aiState: AiAskState;
  readonly aiAnswers: readonly AiAnswer[];
  readonly aiProviders: readonly AiProviderId[];
  readonly aiPicks: Readonly<Partial<Record<AiFeature, AiProviderId>>>;
  readonly pickAiProvider: (feature: AiFeature, provider: AiProviderId) => void;
  readonly askAi: (feature: AiFeature, fresh?: boolean) => void;
  readonly aiLanguage: 'native' | 'target';
  readonly pickAiLanguage: (lang: 'native' | 'target') => void;
  readonly checkedChunks: ReadonlySet<number>;
  readonly toggleChunk: (index: number) => void;
  readonly checkedAiFeatures: ReadonlySet<AiFeature>;
  readonly toggleAiFeature: (feature: AiFeature) => void;
  readonly translateEngine: 'google' | 'ai';
  readonly pickTranslateSource: (source: 'google' | AiProviderId) => void;
  readonly translationSource: 'google' | 'ai' | null;
  readonly playTerm: () => void;
  readonly playSentence: () => void;
  readonly autoplayCount: number;
  readonly sendToCard: () => Promise<void>;
  readonly quickAdd: () => Promise<void>;
}

export function useCandidate(options: UseCandidateOptions): UseCandidateReturn {
  const {
    candidate,
    contextSentence,
    sourceLang,
    targetLang,
    onSendToCard,
    onQuickAdd,
    onAiNoteUpdate,
    onStatusChange,
    defaultActiveTab,
    selectionSnapshot,
    initialAudioItems,
    initialImageItems,
    preloadMedia,
  } = options;

  // The snapshot prop is typed as PopupSelectionSnapshot for callers, but the
  // runtime value passed from the integrated panel is a full PopupCardCreatorPrefill
  // (or DictionaryPanelPrefill). Cast so we can access audio/image items + translation.
  const fullSnapshot = selectionSnapshot as (PopupSelectionSnapshot & Partial<PopupCardCreatorPrefill>) | undefined;

  const [status, setStatus] = useState<WordStatus>(candidate.status);
  const [prevCandidateStatus, setPrevCandidateStatus] = useState(candidate.status);
  // Render-time resync: an external status edit (e.g. the 1-4 keyboard path →
  // mount.setStatus → syncStatus) lands as a new candidate object — mirror it
  // without the post-mount stomp a useEffect would cause on fresh mounts.
  if (prevCandidateStatus !== candidate.status) {
    setPrevCandidateStatus(candidate.status);
    setStatus(candidate.status);
  }
  // pos-dictionary-variants: selected variant + per-variant accent/status.
  const variants = candidate.variants;
  const [variantIndex, setVariantIndex] = useState(0);
  const variant = variants?.length ? variants[Math.min(variantIndex, variants.length - 1)] : undefined;
  const [accentPref, setAccentPref] = useState<'auto' | 'us' | 'uk'>('auto');
  const [variantStatusOverrides, setVariantStatusOverrides] = useState<Map<string, WordStatus>>(new Map());
  const variantSig = (variants ?? []).map((v) => `${v.pos}:${v.status}`).join('|');
  const [prevVariantSig, setPrevVariantSig] = useState(variantSig);
  if (prevVariantSig !== variantSig) {
    setPrevVariantSig(variantSig);
    setVariantStatusOverrides(new Map());
  }
  const candidateKey = `${candidate.langCode}|${candidate.term}`;
  const [prevCandidateKey, setPrevCandidateKey] = useState(candidateKey);
  if (prevCandidateKey !== candidateKey) {
    setPrevCandidateKey(candidateKey);
    setVariantIndex(0);
  }
  useEffect(() => {
    let alive = true;
    void loadSettings()
      .then((s) => {
        if (alive) setAccentPref(s.dictionaryPopup?.accentPreference ?? 'auto');
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const accentIndex = (() => {
    if (!variant) return 0;
    if (accentPref !== 'auto') {
      const want = accentPref === 'uk' ? 'br' : accentPref;
      const idx = variant.prons.findIndex((p) => normalizeAccent(p.accent) === want);
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  const selectVariant = useCallback((index: number): void => {
    setVariantIndex(index);
  }, []);

  const displayReading = variant
    ? (variant.prons[accentIndex]?.ipa ?? '')
    : candidate.reading;
  const displayDefinitions = variant?.definitions ?? candidate.definitions;
  const displayFrequencies = variant ? variant.frequencies : candidate.frequencies;
  const displayStars = variant ? variant.frequencyStars : candidate.frequencyStars;
  const displayInflections = variant ? variant.inflections : candidate.inflections;
  const imageQueryTerm = variant?.pos ? `${candidate.term} ${variant.pos}` : candidate.term;

  const selectedDefinitionIds = fullSnapshot?.selectedDefinitionIds;
  const selectedExampleIds = fullSnapshot?.selectedExampleIds;
  const [definitionSelection, setDefinitionSelection] = useState<DefinitionSelection>(
    () => initDefinitionSelection(candidate, selectedDefinitionIds),
  );
  const [exampleSelection, setExampleSelection] = useState<Map<string, Set<number>>>(
    () => initExampleSelection(candidate, selectedExampleIds),
  );

  // Re-initialize definition selection when the candidate identity (term + lang)
  // or the incoming selection snapshot changes. This keeps the integrated
  // Dictionary in sync without wiping user toggles on a simple status cycle.
  const selectionKeyRef = useRef(
    JSON.stringify([candidate.langCode, candidate.term, selectedDefinitionIds ?? null, selectedExampleIds ?? null]),
  );
  useEffect(() => {
    const key = JSON.stringify([candidate.langCode, candidate.term, selectedDefinitionIds ?? null, selectedExampleIds ?? null]);
    if (selectionKeyRef.current === key) return;
    selectionKeyRef.current = key;
    setDefinitionSelection(initDefinitionSelection(candidate, selectedDefinitionIds));
    setExampleSelection(initExampleSelection(candidate, selectedExampleIds));
  }, [candidate, selectedDefinitionIds, selectedExampleIds]);

  const effectiveAudioItems = initialAudioItems ?? fullSnapshot?.audioItems;
  const effectiveImageItems = initialImageItems ?? fullSnapshot?.imageItems;

  const initialAudioSelection = useMemo(() => {
    const items = effectiveAudioItems;
    const selectedIds = fullSnapshot?.selectedAudioIds;
    if (!items || items.length === 0) return null;
    const selectedSet = selectedIds ? new Set(selectedIds) : null;
    const map = new Map<string, boolean>();
    for (const item of items) {
      map.set(item.id, selectedSet ? selectedSet.has(item.id) : false);
    }
    return map;
  }, [effectiveAudioItems, fullSnapshot?.selectedAudioIds]);

  const initialImageSelection = useMemo(() => {
    const items = effectiveImageItems;
    const selectedIds = fullSnapshot?.selectedImageIds;
    if (!items || items.length === 0) return null;
    const selectedSet = selectedIds ? new Set(selectedIds) : null;
    const map = new Map<string, boolean>();
    for (const item of items) {
      map.set(item.id, selectedSet ? selectedSet.has(item.id) : false);
    }
    return map;
  }, [effectiveImageItems, fullSnapshot?.selectedImageIds]);

  const initialTranslation = fullSnapshot?.translation;
  const initialTranslationSelected = fullSnapshot?.translationSelected;

  const [dictLinks, setDictLinks] = useState<readonly ExternalDictLinkTemplate[]>(
    DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks,
  );

  const toolbar = useDictionaryToolbar({
    result: candidate,
    contextSentence,
    sourceLang,
    targetLang,
    defaultActiveTab,
    externalDictLinks: dictLinks,
    initialAudioItems: effectiveAudioItems,
    initialImageItems: effectiveImageItems,
    initialAudioSelection,
    initialImageSelection,
    initialTranslation,
    initialTranslationSelected,
    preloadMedia,
    imageQuery: variant?.pos ? imageQueryTerm : undefined,
  });

  const selectedDefinitions = useMemo(() => {
    const all = getSelectedDefinitions(candidate, definitionSelection);
    if (!variant) return all;
    const variantDefIds = new Set(variant.definitions.map((d) => d.id));
    return all.filter((d) => variantDefIds.has(d.id));
  }, [candidate, definitionSelection, variant]);

  const selectedDefinitionCount = selectedDefinitions.length;

  const variantStatus = variant
    ? (variantStatusOverrides.get(variant.pos) ?? variant.status)
    : status;

  // Shared status write-path: variant override or root state + optional
  // persist + token repaint + consumer notification.
  const applyStatus = useCallback((newStatus: WordStatus, persist: boolean): void => {
    const pos = variant?.pos;
    if (variant && pos) {
      setVariantStatusOverrides((prev) => new Map(prev).set(pos, newStatus));
      if (persist) void setWordStatus(candidate.langCode, candidate.term, newStatus, pos);
      const resolved = new Map(
        (variants ?? [])
          .filter((v) => v.pos !== '')
          .map((v) => [v.pos, v.pos === pos ? newStatus : (variantStatusOverrides.get(v.pos) ?? v.status)]),
      );
      emitWordStatusChanged({
        term: candidate.term,
        langCode: candidate.langCode,
        status: aggregatePosStatus(status, resolved),
        pos,
      });
    } else {
      if (variant) {
        setVariantStatusOverrides((prev) => new Map(prev).set('', newStatus));
      }
      setStatus(newStatus);
      if (persist) void setWordStatus(candidate.langCode, candidate.term, newStatus);
      emitWordStatusChanged({ term: candidate.term, langCode: candidate.langCode, status: newStatus });
    }
    onStatusChange?.(candidate.term, candidate.langCode, newStatus);
  }, [variant, variants, status, variantStatusOverrides, candidate.langCode, candidate.term, onStatusChange]);

  const cycleStatus = useCallback((): void => {
    applyStatus(nextStatus(variantStatus), true);
  }, [applyStatus, variantStatus]);

  const toggleTracking = useCallback((): void => {
    const newStatus = toggleTrackingFlag(variantStatus);
    if (newStatus === variantStatus) return;
    applyStatus(newStatus, true);
  }, [applyStatus, variantStatus]);

  const [srsCardCount, setSrsCardCount] = useState(0);
  useEffect(() => {
    let alive = true;
    getSrsTermCardCount(candidate.langCode, candidate.term)
      .then((result) => { if (alive) setSrsCardCount(result.count); })
      .catch(() => {});
    return () => { alive = false; };
  }, [candidate.langCode, candidate.term, variantStatus]);

  const [includeAllExamples, setIncludeAllExamples] = useState(false);
  const [ttsVoices, setTtsVoices] = useState<readonly string[]>([]);
  const [autoplayCount, setAutoplayCount] = useState(0);
  useEffect(() => {
    let alive = true;
    loadSettings()
      .then((s) => {
        if (!alive) return;
        setTtsVoices(s.dictionaryPopup?.tts?.voices ?? []);
        setAutoplayCount(s.dictionaryPopup?.tts?.autoplayCount ?? 0);
        setIncludeAllExamples(s.dictionaryPopup?.includeAllExamplesOnDefSelect ?? false);
        setDictLinks(s.dictionaryPopup?.externalDictLinks ?? DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const toggleDefinition = useCallback((id: string, selected: boolean): void => {
    const { defId, subIndex } = splitSelectionId(id);
    setDefinitionSelection((prev) => {
      const next = new Map(prev).set(id, selected);
      if (subIndex !== undefined && selected) next.set(defId, true);
      return next;
    });
    setExampleSelection((prev) => {
      const next = new Map(prev);
      if (selected && includeAllExamples) {
        for (const ownerId of subIndex === undefined ? [id] : [id, defId]) {
          const examples = examplesForSelectionId(candidate, ownerId) ?? [];
          next.set(ownerId, new Set(examples.map((_, i) => i)));
        }
      } else {
        next.delete(id);
      }
      return next;
    });
  }, [candidate, includeAllExamples]);

  const toggleExample = useCallback((ownerId: string, index: number, selected: boolean): void => {
    setExampleSelection((prev) => {
      const next = new Map(prev);
      const indices = new Set(prev.get(ownerId) ?? []);
      if (selected) indices.add(index); else indices.delete(index);
      next.set(ownerId, indices);
      return next;
    });
    if (selected) {
      const { defId } = splitSelectionId(ownerId);
      setDefinitionSelection((prev) => {
        if (prev.get(ownerId) === true && prev.get(defId) === true) return prev;
        const next = new Map(prev).set(ownerId, true);
        next.set(defId, true);
        return next;
      });
    }
  }, []);

  const playTerm = useCallback((): void => {
    void sendMessage({
      type: MESSAGE_TYPES.TTS_SPEAK,
      payload: { text: candidate.term, langCode: candidate.langCode, voiceName: ttsVoices[0] },
    });
  }, [candidate.langCode, candidate.term, ttsVoices]);

  const playSentence = useCallback((): void => {
    const sentence = contextSentence.trim() || candidate.term;
    if (!sentence) return;
    void sendMessage({
      type: MESSAGE_TYPES.TTS_SPEAK,
      payload: { text: sentence, langCode: candidate.langCode, voiceName: ttsVoices[0] },
    });
  }, [candidate.langCode, candidate.term, contextSentence, ttsVoices]);

  const buildCurrentPrefill = useCallback((): PopupCardCreatorPrefill => {
    const breakdown = toolbar.aiAnswers.find((a) => a.feature === 'sentenceBreakdown');
    const chunks = breakdown ? parseBreakdown(breakdown.text) : [];
    const chunkDefs: DefinitionEntry[] = [...toolbar.checkedChunks]
      .sort((a, b) => a - b)
      .map((i) => chunks[i])
      .filter((c): c is BreakdownChunk => c !== undefined)
      .map((c, i) => ({
        id: `ai-chunk-${i}`,
        text: c.meaning ? `${c.text} — ${c.meaning}` : c.text,
        source: 'ai',
        examples: [],
        defaultSelected: true,
      }));
    return buildPrefill(
      candidate,
      selectedDefinitions,
      exampleSelection,
      definitionSelection,
      contextSentence,
      toolbar.translation,
      toolbar.audioItems,
      toolbar.audioSelection,
      toolbar.imageItems,
      toolbar.imageSelection,
      toolbar.translationSelected,
      variant ? { variant, accentIndex } : undefined,
      formatAiNoteBlocks(toolbar.aiAnswers.filter((a) => toolbar.checkedAiFeatures.has(a.feature))),
      chunkDefs,
    );
  }, [toolbar, candidate, selectedDefinitions, exampleSelection, definitionSelection, contextSentence, variant, accentIndex]);

  // REQ-5: after a send/quick-add, push late-arriving AI answers into the open
  // card dialog so the note gains each block once, without overwriting edits.
  const sentNoteRef = useRef<string | null>(null);
  const onAiNoteUpdateRef = useRef(onAiNoteUpdate);
  useEffect(() => {
    onAiNoteUpdateRef.current = onAiNoteUpdate;
  });
  useEffect(() => {
    if (sentNoteRef.current === null) return;
    const optedIn = toolbar.aiAnswers.filter((a) => toolbar.checkedAiFeatures.has(a.feature));
    const next = mergeAiNoteBlocks(sentNoteRef.current, optedIn);
    if (next !== sentNoteRef.current) {
      sentNoteRef.current = next;
      onAiNoteUpdateRef.current?.(optedIn);
    }
  }, [toolbar.aiAnswers, toolbar.checkedAiFeatures]);

  // REQ-2: dictionary miss → auto-open the AI tab once per candidate.
  // The settings read resolves after the user may have picked a tab — a manual
  // choice always wins over the auto-open.
  const missAutoOpenedRef = useRef(false);
  const activeTabRef = useRef(toolbar.activeTab);
  useEffect(() => {
    activeTabRef.current = toolbar.activeTab;
  }, [toolbar.activeTab]);
  useEffect(() => {
    missAutoOpenedRef.current = false;
  }, [candidate.term, candidate.langCode]);
  useEffect(() => {
    if (missAutoOpenedRef.current || displayDefinitions.length > 0 || !candidate.term) return;
    missAutoOpenedRef.current = true;
    const openAi = (): void => {
      if (!activeTabRef.current) toolbar.setActiveTab('ai');
    };
    void loadSettings()
      .then((s) => {
        if (s.aiBridge?.autoOpenOnMiss ?? DEFAULT_AI_BRIDGE_SETTINGS.autoOpenOnMiss) openAi();
      })
      .catch(openAi);
  }, [displayDefinitions.length, candidate.term, candidate.langCode, toolbar.setActiveTab]);

  const sendToCard = useCallback(async (): Promise<void> => {
    if (!onSendToCard) return;
    const prefill = buildCurrentPrefill();
    sentNoteRef.current = prefill.note ?? '';
    onSendToCard(prefill);
  }, [onSendToCard, buildCurrentPrefill]);

  const quickAdd = useCallback(async (): Promise<void> => {
    if (!onQuickAdd) return;
    const prefill = buildCurrentPrefill();
    sentNoteRef.current = prefill.note ?? '';
    onQuickAdd(prefill);
  }, [onQuickAdd, buildCurrentPrefill]);

  return {
    status: variantStatus,
    cycleStatus,
    toggleTracking,
    srsCardCount,
    variant,
    variantIndex,
    selectVariant,
    accentIndex,
    displayReading,
    displayDefinitions,
    displayFrequencies,
    displayStars,
    displayInflections,
    imageQueryTerm,
    activeTab: toolbar.activeTab,
    setActiveTab: toolbar.setActiveTab,
    definitionSelection,
    toggleDefinition,
    exampleSelection,
    toggleExample,
    selectedDefinitions,
    selectedDefinitionCount,
    audioItems: toolbar.audioItems,
    audioLoading: toolbar.audioLoading,
    audioError: toolbar.audioError,
    localAudioNeedsRegrant: toolbar.localAudioNeedsRegrant,
    audioSelection: toolbar.audioSelection,
    toggleAudio: toolbar.toggleAudio,
    selectedAudioCount: toolbar.selectedAudioCount,
    imageItems: toolbar.imageItems,
    imageLoading: toolbar.imageLoading,
    imageError: toolbar.imageError,
    imageSelection: toolbar.imageSelection,
    toggleImage: toolbar.toggleImage,
    removeImageItem: toolbar.removeImageItem,
    selectedImageCount: toolbar.selectedImageCount,
    links: toolbar.links,
    selectedLinkCount: toolbar.selectedLinkCount,
    translation: toolbar.translation,
    isTranslating: toolbar.isTranslating,
    translationError: toolbar.translationError,
    translationSelected: toolbar.translationSelected,
    toggleTranslation: toolbar.toggleTranslation,
    translate: toolbar.translate,
    selectedTranslationCount: toolbar.selectedTranslationCount,
    aiState: toolbar.aiState,
    aiAnswers: toolbar.aiAnswers,
    aiProviders: toolbar.aiProviders,
    aiPicks: toolbar.aiPicks,
    pickAiProvider: toolbar.pickAiProvider,
    askAi: toolbar.askAi,
    aiLanguage: toolbar.aiLanguage,
    pickAiLanguage: toolbar.pickAiLanguage,
    checkedChunks: toolbar.checkedChunks,
    toggleChunk: toolbar.toggleChunk,
    checkedAiFeatures: toolbar.checkedAiFeatures,
    toggleAiFeature: toolbar.toggleAiFeature,
    translateEngine: toolbar.translateEngine,
    pickTranslateSource: toolbar.pickTranslateSource,
    translationSource: toolbar.translationSource,
    playTerm,
    playSentence,
    autoplayCount,
    sendToCard,
    quickAdd,
  };
}
