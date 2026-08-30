// useDictionaryToolbar — headless hook for the 4 dictionary media tabs.
//
// Manages active tab, audio/image/translate data + selections, and count
// badges. No DOM dependency — used by CandidateView (per candidate) and
// DictionaryPanelView / PopupDictionary (active result).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS, DEFAULT_PRONUNCIATION_SETTINGS } from '@/shared/config/config';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import type { MessageResponse } from '@/entities/message/types';
import { pronunciationEngine } from '@/features/pronunciation/services/pronunciationEngineSingleton';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation/services/pronunciationAudioOrchestrator';
import type { PronunciationResult } from '@/features/pronunciation/types';
import type {
  LookupResult,
  PopupTab,
  AudioItem,
  ImageItem,
  ExternalDictLink,
  FetchImagesResponse,
  TtsFetchAudioResponse,
} from '../types';

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
}

export interface UseDictionaryToolbarReturn {
  /** Currently open media tab, or null when none. */
  readonly activeTab: PopupTab | null;
  /** Open or close a media tab. */
  readonly setActiveTab: (tab: PopupTab | null) => void;

  readonly pronunciation: PronunciationResult | null;
  readonly pronunciationLoading: boolean;
  readonly pronunciationError: string | null;

  readonly audioItems: readonly AudioItem[];
  readonly audioLoading: boolean;
  readonly audioError: string | null;
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

  readonly links: readonly ExternalDictLink[];
  readonly selectedLinkCount: number;

  readonly fetchAudio: () => Promise<readonly AudioItem[]>;
  readonly fetchImages: () => Promise<readonly ImageItem[]>;
}

function fillExternalDictLinks(
  templates: readonly { readonly id: string; readonly name: string; readonly urlTemplate: string; readonly langCodes: readonly string[] }[],
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
    }));
}

export function useDictionaryToolbar(options: UseDictionaryToolbarOptions): UseDictionaryToolbarReturn {
  const { result, contextSentence, sourceLang, targetLang, defaultActiveTab } = options;

  const [activeTab, setActiveTab] = useState<PopupTab | null>(defaultActiveTab ?? null);
  const [audioItems, setAudioItems] = useState<readonly AudioItem[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSelection, setAudioSelection] = useState<Map<string, boolean>>(new Map());

  const [pronunciation, setPronunciation] = useState<PronunciationResult | null>(null);
  const [pronunciationLoading, setPronunciationLoading] = useState(false);
  const [pronunciationError, setPronunciationError] = useState<string | null>(null);
  const [imageItems, setImageItems] = useState<readonly ImageItem[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSelection, setImageSelection] = useState<Map<string, boolean>>(new Map());
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationSelected, setTranslationSelected] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const resetMediaState = useCallback((): void => {
    setAudioItems([]);
    setAudioLoading(false);
    setAudioError(null);
    setAudioSelection(new Map());
    setImageItems([]);
    setImageLoading(false);
    setImageError(null);
    setImageSelection(new Map());
    setTranslation('');
    setTranslationError(null);
    setTranslationSelected(false);
    setPronunciation(null);
    setPronunciationLoading(false);
    setPronunciationError(null);
  }, []);

  // Reset tab + media data when the looked-up result changes.
  useEffect(() => {
    setActiveTab(defaultActiveTab ?? null);
    resetMediaState();
  }, [result?.term, result?.langCode, defaultActiveTab, resetMediaState]);

  // Fetch eSpeak IPA/phonemes whenever the result term changes.
  useEffect(() => {
    const term = result?.term;
    const langCode = result?.langCode;
    if (!term || !langCode) {
      setPronunciation(null);
      return;
    }
    let cancelled = false;
    setPronunciationLoading(true);
    setPronunciationError(null);
    pronunciationEngine
      .toPronunciation(term, langCode)
      .then((p) => {
        if (cancelled) return;
        setPronunciation(p);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPronunciationError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setPronunciationLoading(false);
      });
    return () => { cancelled = true; };
  }, [result?.term, result?.langCode]);

  const fetchAudio = useCallback((): Promise<readonly AudioItem[]> => {
    if (!result) return Promise.resolve([]);
    if (audioItems.length > 0) return Promise.resolve(audioItems);
    setAudioLoading(true);
    setAudioError(null);

    return (async (): Promise<readonly AudioItem[]> => {
      try {
        const settings = await loadSettings();
        const pronunciationSettings = settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS;
        const orchestrator = new PronunciationAudioOrchestrator(pronunciationSettings);

        const [wordItems, ttsRes] = await Promise.all([
          orchestrator.resolve(result.term, result.langCode),
          sendMessage<MessageResponse<TtsFetchAudioResponse>>({
            type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
            payload: { tabId: 0, text: contextSentence.trim() || result.term, langCode: result.langCode },
          }),
        ]);

        const items: AudioItem[] = [...wordItems];

        if (ttsRes?.success && ttsRes.data?.url) {
          items.push({
            id: `tts-sentence-${result.term}`,
            kind: 'sentence',
            source: 'system-tts',
            label: 'System TTS · Sentence',
            state: 'idle',
            url: ttsRes.data.url,
            defaultSelected: false,
          });
        }

        if (items.length === 0) {
          setAudioError(ttsRes?.error ?? 'Audio fetch failed');
        }

        if (mountedRef.current) {
          setAudioItems(items);
          setAudioSelection(new Map(items.map((item) => [item.id, item.defaultSelected])));
        }

        return items;
      } catch (err: unknown) {
        if (mountedRef.current) {
          setAudioError(err instanceof Error ? err.message : String(err));
        }
        return [];
      } finally {
        if (mountedRef.current) setAudioLoading(false);
      }
    })();
  }, [audioItems, result, contextSentence]);

  const fetchImages = useCallback((): Promise<readonly ImageItem[]> => {
    if (!result) return Promise.resolve([]);
    if (imageItems.length > 0) return Promise.resolve(imageItems);
    setImageLoading(true);
    setImageError(null);

    return sendMessage<MessageResponse<FetchImagesResponse>>({
      type: MESSAGE_TYPES.FETCH_IMAGES,
      payload: { tabId: 0, term: result.term, langCode: result.langCode },
    })
      .then((response) => {
        if (response?.success && response.data?.items) {
          const items = response.data.items;
          if (mountedRef.current) {
            setImageItems(items);
            setImageSelection(new Map(items.map((item) => [item.id, item.defaultSelected])));
          }
          return items;
        }
        if (mountedRef.current) setImageError(response?.error ?? 'Image fetch failed');
        return [];
      })
      .catch((err: unknown) => {
        if (mountedRef.current) setImageError(err instanceof Error ? err.message : String(err));
        return [];
      })
      .finally(() => {
        if (mountedRef.current) setImageLoading(false);
      });
  }, [imageItems, result]);

  const translate = useCallback((): Promise<string> => {
    if (!result) return Promise.resolve('');
    const text = contextSentence.trim() || result.term.trim();
    if (!text) return Promise.resolve(translation);
    if (translation) return Promise.resolve(translation);
    setIsTranslating(true);
    setTranslationError(null);
    return translateSentence(text, sourceLang, targetLang)
      .then((res) => {
        if (mountedRef.current) {
          setTranslation(res);
          if (!res) setTranslationError('Translation failed. Please try again.');
        }
        return res;
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          setTranslation('');
          setTranslationError(err instanceof Error ? err.message : String(err));
        }
        return '';
      })
      .finally(() => {
        if (mountedRef.current) setIsTranslating(false);
      });
  }, [contextSentence, result, sourceLang, targetLang, translation]);

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

  // Lazy-load tab data when a tab becomes active.
  useEffect(() => {
    if (activeTab === 'audio') {
      void fetchAudio();
    } else if (activeTab === 'image') {
      void fetchImages();
    }
  }, [activeTab, fetchAudio, fetchImages]);

  const selectedAudioCount = useMemo(
    () => audioItems.filter((item) => audioSelection.get(item.id) ?? item.defaultSelected).length,
    [audioItems, audioSelection],
  );

  const selectedImageCount = useMemo(
    () => imageItems.filter((item) => imageSelection.get(item.id) ?? item.defaultSelected).length,
    [imageItems, imageSelection],
  );

  const selectedTranslationCount = translationSelected ? 1 : 0;

  const links = useMemo(
    () => (result?.term && result?.langCode
      ? fillExternalDictLinks(DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks, result.term, result.langCode)
      : []),
    [result?.term, result?.langCode],
  );

  return {
    activeTab,
    setActiveTab,
    pronunciation,
    pronunciationLoading,
    pronunciationError,
    audioItems,
    audioLoading,
    audioError,
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
    links,
    selectedLinkCount: links.length,
    fetchAudio,
    fetchImages,
  };
}
