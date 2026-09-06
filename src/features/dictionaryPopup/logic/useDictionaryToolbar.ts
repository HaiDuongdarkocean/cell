// useDictionaryToolbar — headless hook for the 4 dictionary media tabs.
//
// Manages active tab, audio/image/translate data + selections, and count
// badges. No DOM dependency — used by CandidateView (per candidate) and
// DictionaryPanelView / PopupDictionary (active result).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS, DEFAULT_PRONUNCIATION_SETTINGS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { translateSentence } from '@/features/cardCreator/media/translation';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation/services/pronunciationAudioOrchestrator';
import type { MessageResponse } from '@/entities/message/types';
import type {
  LookupResult,
  PopupTab,
  AudioItem,
  ImageItem,
  ExternalDictLink,
  FetchImagesResponse,
  TtsFetchAudioResponse,
} from '../types';
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
}

export interface UseDictionaryToolbarReturn {
  /** Currently open media tab, or null when none. */
  readonly activeTab: PopupTab | null;
  /** Open or close a media tab. */
  readonly setActiveTab: (tab: PopupTab | null) => void;

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
  }, []);

  useEffect(() => {
    setActiveTab(defaultActiveTab ?? null);
    resetMediaState();
  }, [result?.term, result?.langCode, defaultActiveTab, resetMediaState]);

  const fetchAudio = useCallback((): Promise<readonly AudioItem[]> => {
    if (!result) return Promise.resolve([]);
    if (audioLoading) return Promise.resolve([]);
    if (audioItems.length > 0) return Promise.resolve(audioItems);
    setAudioLoading(true);
    setAudioError(null);

    return (async (): Promise<readonly AudioItem[]> => {
      try {
        // If loadSettings hangs, fall back to defaults so the audio API still gets a chance.
        const [settings, sentenceTtsRes] = await Promise.all([
          withTimeout(loadSettings(), 5_000).catch(() => DEFAULT_SETTINGS),
          withTimeout(
            sendMessage<MessageResponse<TtsFetchAudioResponse>>({
              type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
              payload: { tabId: 0, text: contextSentence.trim() || result.term, langCode: result.langCode },
            }),
            8_000,
          ).catch(() => undefined),
        ]);

        const orchestrator = new PronunciationAudioOrchestrator(
          settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS,
        );
        const wordItems = await withTimeout(
          orchestrator.resolve(result.term, result.langCode),
          15_000,
        );

        const sentenceItems: AudioItem[] = [];
        if (sentenceTtsRes?.success && sentenceTtsRes.data?.url) {
          sentenceItems.push({
            id: `tts-sentence-${result.term}`,
            kind: 'sentence',
            source: 'system-tts',
            label: 'System TTS · Sentence',
            state: 'idle',
            url: sentenceTtsRes.data.url,
            defaultSelected: false,
          });
        }

        const items: AudioItem[] = [...wordItems, ...sentenceItems];

        if (items.length === 0) {
          if (sentenceTtsRes?.error) console.warn('[dict] audio fetch failed:', sentenceTtsRes.error);
          setAudioError(t('dict.error.audio'));
        }

        if (mountedRef.current && (items.length > 0 || audioItems.length > 0)) {
          setAudioItems(items);
          setAudioSelection(new Map());
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

  const fetchImages = useCallback((): Promise<readonly ImageItem[]> => {
    if (!result) return Promise.resolve([]);
    if (imageLoading) return Promise.resolve(imageItems);
    if (imageItems.length > 0) return Promise.resolve(imageItems);
    setImageLoading(true);
    setImageError(null);

    return withTimeout(
      sendMessage<MessageResponse<FetchImagesResponse>>({
        type: MESSAGE_TYPES.FETCH_IMAGES,
        payload: { tabId: 0, term: result.term, langCode: result.langCode },
      }),
      10_000,
    )
      .then((response) => {
        if (response?.success && response.data?.items && response.data.items.length > 0) {
          const items = response.data.items;
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
    if (translation) return Promise.resolve(translation);
    if (isTranslating) return Promise.resolve(translation);
    setIsTranslating(true);
    setTranslationError(null);
    return withTimeout(translateSentence(text, sourceLang, targetLang), 10_000)
      .then((res) => {
        if (mountedRef.current) {
          setTranslation(res);
          if (!res) setTranslationError(t('dict.error.translate'));
        }
        return res;
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          console.warn('[dict] translate threw:', err);
          setTranslationError(t('dict.error.translate'));
        }
        return '';
      })
      .finally(() => {
        if (mountedRef.current) setIsTranslating(false);
      });
  }, [contextSentence, result, sourceLang, targetLang, translation, isTranslating]);

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
  useEffect(() => {
    fetchAudioRef.current = fetchAudio;
    fetchImagesRef.current = fetchImages;
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
  }, [activeTab, result?.term, result?.langCode]);

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
      ? fillExternalDictLinks(DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks, result.term, result.langCode)
      : []),
    [result],
  );

  return {
    activeTab,
    setActiveTab,
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
