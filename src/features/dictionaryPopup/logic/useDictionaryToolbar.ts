// useDictionaryToolbar — headless hook for the 4 dictionary media tabs.
//
// Manages active tab, audio/image/translate data + selections, and count
// badges. No DOM dependency — used by CandidateView (per candidate) and
// DictionaryPanelView / PopupDictionary (active result).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { markAudio, measureAudio } from '@/shared/lib/perfMarks';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS, DEFAULT_PRONUNCIATION_SETTINGS, DEFAULT_AI_BRIDGE_SETTINGS } from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { translateSentence } from '@/features/cardCreator';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation';
import { composePrompt } from '@/features/aiBridge';
import { useAiAsk, type AiAnswer, type AiAskState } from './useAiAsk';
import type { AiBridgeSettings, AiFeature, AiProviderId } from '@/entities/settings';
import { getLocale } from '@/shared/i18n';
import type { MessageResponse } from '@/entities/message/types';
import type {
  LookupResult,
  PopupTab,
  AudioItem,
  ImageItem,
  ExternalDictLink,
  FetchImagesResponse,
  LocalAudioStateResponse,
} from '@/entities/dictionary';
import { isSafeDictUrl, type ExternalDictLinkTemplate } from '@/entities/settings';
import { t } from '@/shared/i18n';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

export interface UseDictionaryToolbarOptions {
  /** The candidate/result the toolbar operates on. */
  readonly result: LookupResult | null;
  /** Sentence context for translation. */
  readonly contextSentence: string;
  /** Source language for translation. */
  readonly sourceLang: string;
  /** Target language for translation. */
  readonly targetLang: string;
  /** Default media tab to open when the result first appears. */
  readonly defaultActiveTab?: PopupTab | null;
  /** Stored external dictionary link templates (defaults when unset). */
  readonly externalDictLinks?: readonly ExternalDictLinkTemplate[];
  /** Pre-loaded audio items for this candidate (popup clone). */
  readonly initialAudioItems?: readonly AudioItem[];
  /** Pre-loaded image items for this candidate (popup clone). */
  readonly initialImageItems?: readonly ImageItem[];
  /** Pre-selected audio IDs for this candidate (popup clone). */
  readonly initialAudioSelection?: Map<string, boolean> | null;
  /** Pre-selected image IDs for this candidate (popup clone). */
  readonly initialImageSelection?: Map<string, boolean> | null;
  /** Pre-fetched translation text for this candidate (popup clone). */
  readonly initialTranslation?: string;
  /** Whether the translation checkbox was selected in the popup clone. */
  readonly initialTranslationSelected?: boolean;
  /** Preload all media/translation for the integrated panel so Send to Card works
   *  without the user manually opening each tab. */
  readonly preloadMedia?: boolean;
  /** pos-dictionary-variants: image search term override (`${term} ${pos}`). */
  readonly imageQuery?: string;
}

export interface UseDictionaryToolbarReturn {
  /** Currently open media tab, or null when none. */
  readonly activeTab: PopupTab | null;
  /** Open or close a media tab. */
  readonly setActiveTab: (tab: PopupTab | null) => void;

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

  readonly translation: string;
  readonly isTranslating: boolean;
  readonly translationError: string | null;
  readonly translationSelected: boolean;
  readonly toggleTranslation: () => void;
  readonly translate: () => Promise<string>;
  readonly selectedTranslationCount: number;

  // === AI bridge (spec ai-bridge-dictionary) ===
  readonly aiState: AiAskState;
  /** Latest answer per feature — feeds panels + the card note blocks. */
  readonly aiAnswers: readonly AiAnswer[];
  /** Failover order shown as provider pills (settings providerOrder). */
  readonly aiProviders: readonly AiProviderId[];
  /** Per-session provider picks overriding the settings default. */
  readonly aiPicks: Readonly<Partial<Record<AiFeature, AiProviderId>>>;
  readonly pickAiProvider: (feature: AiFeature, provider: AiProviderId) => void;
  /** Fire (or re-fire) an ask for a feature — tab-open trigger AND retry. */
  /** `fresh` bypasses the tab-session answer cache (retry/regenerate). */
  readonly askAi: (feature: AiFeature, fresh?: boolean) => void;
  /** [ANSWER_LANG] source: interface ('native') or target language. */
  readonly aiLanguage: 'native' | 'target';
  readonly pickAiLanguage: (lang: 'native' | 'target') => void;
  readonly translateEngine: 'google' | 'ai';
  /** Engine that produced the current translation — attribution for the header. */
  readonly translationSource: 'google' | 'ai' | null;

  readonly links: readonly ExternalDictLink[];
  readonly selectedLinkCount: number;

  readonly fetchAudio: () => Promise<readonly AudioItem[]>;
  readonly fetchImages: () => Promise<readonly ImageItem[]>;
}

export function fillExternalDictLinks(
  templates: readonly ExternalDictLinkTemplate[],
  term: string,
  langCode: string,
): ExternalDictLink[] {
  const encodedTerm = encodeURIComponent(term);
  return templates
    .filter((t) => t.langCodes.length === 0 || t.langCodes.includes(langCode))
    .map((t) => ({
      id: t.id,
      name: t.name,
      url: t.urlTemplate.replaceAll('{term}', encodedTerm).replaceAll('{lang}', langCode),
    }))
    .filter((l) => isSafeDictUrl(l.url));
}

export function useDictionaryToolbar(options: UseDictionaryToolbarOptions): UseDictionaryToolbarReturn {
  const {
    result,
    contextSentence,
    sourceLang,
    targetLang,
    defaultActiveTab,
    externalDictLinks,
    initialAudioItems,
    initialImageItems,
    initialAudioSelection,
    initialImageSelection,
    initialTranslation,
    initialTranslationSelected,
    preloadMedia,
    imageQuery,
  } = options;

  const [activeTab, setActiveTab] = useState<PopupTab | null>(defaultActiveTab ?? null);
  const [audioItems, setAudioItems] = useState<readonly AudioItem[]>(initialAudioItems ?? []);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [localAudioNeedsRegrant, setLocalAudioNeedsRegrant] = useState(false);
  const [audioSelection, setAudioSelection] = useState<Map<string, boolean>>(
    initialAudioSelection ? new Map(initialAudioSelection) : new Map(),
  );
  const [imageItems, setImageItems] = useState<readonly ImageItem[]>(initialImageItems ?? []);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSelection, setImageSelection] = useState<Map<string, boolean>>(
    initialImageSelection ? new Map(initialImageSelection) : new Map(),
  );
  const [translation, setTranslation] = useState(initialTranslation ?? '');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationSelected, setTranslationSelected] = useState(initialTranslationSelected ?? false);

  const ai = useAiAsk();
  const aiCfgRef = useRef<AiBridgeSettings | null>(null);
  const [aiProviders, setAiProviders] = useState<readonly AiProviderId[]>(DEFAULT_AI_BRIDGE_SETTINGS.providerOrder);
  const [aiPicks, setAiPicks] = useState<Partial<Record<AiFeature, AiProviderId>>>({});
  const aiPicksRef = useRef(aiPicks);
  const [translateEngine, setTranslateEngineState] = useState<'google' | 'ai'>(DEFAULT_AI_BRIDGE_SETTINGS.sentenceTranslateEngine);
  const [translationSource, setTranslationSource] = useState<'google' | 'ai' | null>(initialTranslation ? 'google' : null);
  const [aiLanguage, setAiLanguage] = useState<'native' | 'target'>(DEFAULT_AI_BRIDGE_SETTINGS.answerLanguage);
  const googleTranslationRef = useRef(initialTranslation ?? '');

  const ensureAiCfg = useCallback(async (): Promise<AiBridgeSettings> => {
    if (aiCfgRef.current) return aiCfgRef.current;
    const s = await withTimeout(loadSettings(), 5_000).catch(() => null);
    const cfg = s?.aiBridge ?? DEFAULT_AI_BRIDGE_SETTINGS;
    aiCfgRef.current = cfg;
    if (mountedRef.current) {
      setAiProviders(cfg.providerOrder);
      setTranslateEngineState(cfg.sentenceTranslateEngine);
      setAiLanguage(cfg.answerLanguage);
    }
    return cfg;
  }, []);

  const composeAiPrompt = useCallback(
    (feature: AiFeature, cfg: AiBridgeSettings): string => {
      const interfaceName = getLocale() === 'vi' ? 'Vietnamese' : 'English';
      return composePrompt(feature, cfg.prompts, {
        word: result?.term,
        sentence: contextSentence.trim() || undefined,
        targetLang,
        interfaceLang: interfaceName,
        answerLang: (cfg.answerLanguage ?? 'native') === 'target' ? targetLang : interfaceName,
      });
    },
    [result?.term, contextSentence, targetLang, aiLanguage],
  );

  const askAi = useCallback(
    (feature: AiFeature, fresh = false): void => {
      if (!result) return;
      void (async () => {
        const cfg = await ensureAiCfg();
        const prompt = composeAiPrompt(feature, cfg);
        const answer = await ai.ask(feature, prompt, aiPicksRef.current[feature], fresh);
        if (feature === 'sentenceTranslate' && answer && mountedRef.current) {
          setTranslation(answer.text);
          setTranslationSource('ai');
        }
      })();
    },
    [result, ensureAiCfg, composeAiPrompt, ai.ask],
  );

  const pickAiProvider = useCallback((feature: AiFeature, provider: AiProviderId): void => {
    aiPicksRef.current = { ...aiPicksRef.current, [feature]: provider };
    setAiPicks(aiPicksRef.current);
  }, []);

  const pickAiLanguage = useCallback(
    (lang: 'native' | 'target'): void => {
      setAiLanguage(lang);
      // Sync the ref first so a pick→re-ask in the same tick uses the new lang.
      if (aiCfgRef.current) aiCfgRef.current = { ...aiCfgRef.current, answerLanguage: lang };
      void ensureAiCfg().then((cfg) => {
        aiCfgRef.current = { ...cfg, answerLanguage: lang };
        void saveSettings({ aiBridge: aiCfgRef.current }).catch(() => { /* keep in-memory choice */ });
      });
    },
    [ensureAiCfg],
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Use a ref so the result-change effect can read the latest initial props
  // without including the (potentially unstable) arrays in its dependency list.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const resetMediaState = useCallback((): void => {
    const {
      initialAudioItems: nextAudioItems,
      initialImageItems: nextImageItems,
      initialAudioSelection: nextAudioSelection,
      initialImageSelection: nextImageSelection,
      initialTranslation: nextTranslation,
      initialTranslationSelected: nextTranslationSelected,
    } = optionsRef.current;

    setAudioItems(nextAudioItems ?? []);
    setAudioLoading(false);
    setAudioError(null);
    setLocalAudioNeedsRegrant(false);
    setAudioSelection(nextAudioSelection ? new Map(nextAudioSelection) : new Map());
    setImageItems(nextImageItems ?? []);
    setImageLoading(false);
    setImageError(null);
    setImageSelection(nextImageSelection ? new Map(nextImageSelection) : new Map());
    setTranslation(nextTranslation ?? '');
    setTranslationError(null);
    setTranslationSelected(nextTranslationSelected ?? false);
    googleTranslationRef.current = nextTranslation ?? '';
    ai.reset();
    aiPicksRef.current = {};
    setAiPicks({});
  }, []);

  useEffect(() => {
    setActiveTab(defaultActiveTab ?? null);
    resetMediaState();
  }, [
    result?.term,
    result?.langCode,
    defaultActiveTab,
    resetMediaState,
    initialAudioItems,
    initialImageItems,
    initialAudioSelection,
    initialImageSelection,
    initialTranslation,
    initialTranslationSelected,
  ]);

  const fetchAudio = useCallback((): Promise<readonly AudioItem[]> => {
    if (!result) return Promise.resolve([]);
    if (audioLoading) return Promise.resolve([]);
    if (audioItems.length > 0) return Promise.resolve(audioItems);
    setAudioLoading(true);
    setAudioError(null);
    markAudio('start', result.term);

    return (async (): Promise<readonly AudioItem[]> => {
      try {
        // If loadSettings hangs, fall back to defaults so the audio API still gets a chance.
        const settingsP = withTimeout(loadSettings(), 5_000).catch(() => DEFAULT_SETTINGS);
        const localAudioStateP = withTimeout(
          sendMessage<MessageResponse<LocalAudioStateResponse>>({
            type: MESSAGE_TYPES.LOCAL_AUDIO_STATE,
            payload: {},
          }),
          8_000,
        ).catch(() => undefined);

        const [settings, localAudioState] = await Promise.all([settingsP, localAudioStateP]);

        const needsRegrant = localAudioState?.success === true
          && localAudioState.data?.configured === true
          && (localAudioState.data.permission === 'prompt' || localAudioState.data.permission === 'denied');

        const orchestrator = new PronunciationAudioOrchestrator(
          settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS,
        );
        // Sentence audio shares the configured chain, restricted by the
        // orchestrator to cloud voices + browser voice.
        const sentenceItemsP = orchestrator
          .resolveSentence(contextSentence.trim() || result.term, result.langCode)
          .catch(() => [] as readonly AudioItem[]);
        const wordItems = await withTimeout(
          orchestrator.resolve(result.term, result.langCode),
          15_000,
        );

        if (mountedRef.current) {
          setLocalAudioNeedsRegrant(needsRegrant);
          if (wordItems.length > 0 || audioItems.length > 0) {
            setAudioItems(wordItems);
            setAudioSelection(new Map());
            markAudio('applied', result.term);
            measureAudio('start', 'applied', result.term);
          }
        }

        const sentenceItems = await sentenceItemsP;
        const items: AudioItem[] = [...wordItems, ...sentenceItems];

        if (mountedRef.current) {
          if (items.length === 0) setAudioError(t('dict.error.audio'));
          if (items.length !== wordItems.length) {
            setAudioItems(items);
            if (wordItems.length === 0) setAudioSelection(new Map());
          }
        }

        return items;
      } catch (err: unknown) {
        if (mountedRef.current) {
          console.warn('[dict] audio fetch threw:', err);
          setAudioError(t('dict.error.audio'));
        }
        return [];
      } finally {
        if (mountedRef.current) {
          setAudioLoading(false);
        }
      }
    })();
  }, [audioItems, audioLoading, result, contextSentence]);

  const loadedImageQueryRef = useRef<string | undefined>(
    initialImageItems?.length ? result?.term : undefined,
  );

  const fetchImages = useCallback((): Promise<readonly ImageItem[]> => {
    if (!result) return Promise.resolve([]);
    const query = optionsRef.current.imageQuery ?? result.term;
    if (imageLoading) return Promise.resolve(imageItems);
    if (imageItems.length > 0 && loadedImageQueryRef.current === query) return Promise.resolve(imageItems);
    if (imageItems.length > 0) {
      setImageItems([]);
      setImageSelection(new Map());
    }
    setImageLoading(true);
    setImageError(null);

    return withTimeout(
      sendMessage<MessageResponse<FetchImagesResponse>>({
        type: MESSAGE_TYPES.FETCH_IMAGES,
        payload: { tabId: 0, term: query, langCode: result.langCode },
      }),
      10_000,
    )
      .then((response) => {
        if (response?.success && response.data?.items && response.data.items.length > 0) {
          const items = response.data.items;
          loadedImageQueryRef.current = query;
          if (mountedRef.current) {
            setImageItems(items);
            setImageSelection(new Map());
          }
          return items;
        }
        if (mountedRef.current) {
          if (response?.error) console.warn('[dict] image fetch failed:', response.error);
          setImageError(t('dict.error.images'));
        }
        return [];
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          console.warn('[dict] image fetch threw:', err);
          setImageError(t('dict.error.images'));
        }
        return [];
      })
      .finally(() => {
        if (mountedRef.current) setImageLoading(false);
      });
  }, [imageItems, imageLoading, result]);

  const translate = useCallback((): Promise<string> => {
    if (!result) return Promise.resolve('');
    const text = contextSentence.trim() || result.term.trim();
    if (!text) return Promise.resolve(translation);
    return (async () => {
      const cfg = await ensureAiCfg();
      if (cfg.sentenceTranslateEngine === 'ai') {
        const answer = ai.answers.find((a) => a.feature === 'sentenceTranslate');
        if (answer) {
          if (mountedRef.current) {
            setTranslation(answer.text);
            setTranslationSource('ai');
          }
          return answer.text;
        }
        setIsTranslating(true);
        setTranslationError(null);
        const prompt = composeAiPrompt('sentenceTranslate', cfg);
        const aiAnswer = await ai.ask('sentenceTranslate', prompt, aiPicksRef.current.sentenceTranslate);
        if (mountedRef.current) {
          if (aiAnswer) {
            setTranslation(aiAnswer.text);
            setTranslationSource('ai');
          } else {
            setTranslationError(t('dict.error.translate'));
          }
          setIsTranslating(false);
        }
        return aiAnswer?.text ?? '';
      }
      if (translation || isTranslating) return translation;
      setIsTranslating(true);
      setTranslationError(null);
      try {
        const res = await withTimeout(translateSentence(text, sourceLang, targetLang), 10_000);
        if (mountedRef.current) {
          setTranslation(res);
          setTranslationSource('google');
          googleTranslationRef.current = res;
          if (!res) setTranslationError(t('dict.error.translate'));
        }
        return res;
      } catch (err) {
        if (mountedRef.current) {
          console.warn('[dict] translate threw:', err);
          setTranslationError(t('dict.error.translate'));
        }
        return '';
      } finally {
        if (mountedRef.current) setIsTranslating(false);
      }
    })();
  }, [contextSentence, result, sourceLang, targetLang, translation, isTranslating, ai.answers, ai.ask, ensureAiCfg, composeAiPrompt]);

  const toggleAudio = useCallback((id: string, selected: boolean): void => {
    setAudioSelection((prev) => new Map(prev).set(id, selected));
  }, []);

  const toggleImage = useCallback((id: string, selected: boolean): void => {
    setImageSelection((prev) => new Map(prev).set(id, selected));
  }, []);

  const removeImageItem = useCallback((id: string): void => {
    setImageItems((prev) => prev.filter((item) => item.id !== id));
    setImageSelection((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleTranslation = useCallback((): void => {
    setTranslationSelected((prev) => !prev);
  }, []);

  // Refs keep the latest fetch callbacks so the lazy-load effect can depend on
  // tab + data identity instead of on the callbacks themselves. This breaks a
  // re-fetch loop where state changes (audioLoading / audioItems) would recreate
  // the callback, re-trigger the effect, and start another fetch.
  const fetchAudioRef = useRef<() => Promise<readonly AudioItem[]>>(fetchAudio);
  const fetchImagesRef = useRef<() => Promise<readonly ImageItem[]>>(fetchImages);
  const translateRef = useRef<() => Promise<string>>(translate);
  useEffect(() => {
    fetchAudioRef.current = fetchAudio;
    fetchImagesRef.current = fetchImages;
    translateRef.current = translate;
  });

  // Lazy-load tab data when a tab becomes active.
  useEffect(() => {
    if (activeTab === 'audio') {
      void fetchAudioRef.current();
    }
  }, [activeTab, result?.term, result?.langCode, contextSentence]);

  useEffect(() => {
    if (activeTab === 'image') {
      void fetchImagesRef.current();
    }
  }, [activeTab, result?.term, result?.langCode, imageQuery]);

  // AI tabs fire their ask when opened (spec ai-bridge-dictionary REQ-1/REQ-3).
  // Re-opening after an answer returns the cached answer; after an error the
  // ask is re-issued so a tab toggle doubles as a retry.
  const aiAskRef = useRef(askAi);
  const aiAnswersRef = useRef(ai.answers);
  useEffect(() => {
    aiAskRef.current = askAi;
    aiAnswersRef.current = ai.answers;
  });
  useEffect(() => {
    const feature: AiFeature | null =
      activeTab === 'ai' ? 'wordExplain' : activeTab === 'breakdown' ? 'sentenceBreakdown' : null;
    if (!feature) return;
    if (aiAnswersRef.current.some((a) => a.feature === feature)) return;
    aiAskRef.current(feature);
  }, [activeTab, result?.term, result?.langCode]);

  // Preload audio, image and translation in the integrated panel so the user
  // can press Send to Card immediately without opening every tab.
  const hasResult = result !== null;
  useEffect(() => {
    if (!preloadMedia || !hasResult) return;
    void fetchAudioRef.current();
    void fetchImagesRef.current();
    void translateRef.current();
  }, [preloadMedia, hasResult, result?.term, result?.langCode, imageQuery]);

  const selectedAudioCount = useMemo(
    () => audioItems.filter((item) => audioSelection.get(item.id) === true).length,
    [audioItems, audioSelection],
  );

  const selectedImageCount = useMemo(
    () => imageItems.filter((item) => imageSelection.get(item.id) === true).length,
    [imageItems, imageSelection],
  );

  const selectedTranslationCount = translationSelected ? 1 : 0;

  const links = useMemo(
    () => (result
      ? fillExternalDictLinks(externalDictLinks ?? DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks, result.term, result.langCode)
      : []),
    [result, externalDictLinks],
  );

  return {
    activeTab,
    setActiveTab,
    audioItems,
    audioLoading,
    audioError,
    localAudioNeedsRegrant,
    audioSelection,
    toggleAudio,
    selectedAudioCount,
    imageItems,
    imageLoading,
    imageError,
    imageSelection,
    toggleImage,
    removeImageItem,
    selectedImageCount,
    translation,
    isTranslating,
    translationError,
    translationSelected,
    toggleTranslation,
    translate,
    selectedTranslationCount,
    aiState: ai.state,
    aiAnswers: ai.answers,
    aiProviders,
    aiPicks,
    pickAiProvider,
    askAi,
    aiLanguage,
    pickAiLanguage,
    translateEngine,
    translationSource,
    links,
    selectedLinkCount: links.length,
    fetchAudio,
    fetchImages,
  };
}
