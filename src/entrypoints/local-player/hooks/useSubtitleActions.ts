/**
 * useSubtitleActions — builds SubtitleActionContext for local-player + exposes
 * card/dictionary/generate-native handlers wired to the shared action module.
 *
 * This hook bridges local-player state (video ref, cues store, subtitle engine)
 * to the shared subtitle actions (cardActions.ts, generateNativeAction.ts)
 * that content-script also uses — SSOT for card/dictionary/generate-native logic.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@/shared/i18n';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { getActiveProfileSettings, type DictionaryPopupSettings, type Settings } from '@/entities/settings';
import { modifierMatches } from '@/entities/dictionary';
import { logger } from '@/shared/lib/logger';
import {
  DEFAULT_CARD_CREATOR_SETTINGS,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  STORAGE_KEYS,
} from '@/shared/config/config';
import { createWebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import type { WebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import type { LookupRequest, ClickModifierState } from '@/entities/dictionary';
import type { CueListTokenize } from '@/features/subtitle/ui/CueList';
import { createSubtitleTokenizeController, type SubtitleTokenizeController } from '@/features/tokenize';
import { SPLIT_VIEW_PANEL_SELECTOR } from '@/features/subtitle/logic/scrollPositionPreserve';
import { createCardCreatorActionPorts } from '@/features/cardCreator/service/cardCreatorActionPorts';
import { handleCardCreatorAction } from '@/features/subtitle/actions/cardActions';
import { startGenerateNative } from '@/features/subtitle/actions/generateNativeAction';
import type { SubtitleActionContext } from '@/features/subtitle/actions/subtitleActionContext';
import type { CardCreatorAction } from '@/features/subtitle/ui/subtitleCueEngine';
import { useCuesStore } from '@/features/subtitle/cuesStore';
import type { SrtCue } from '@/entities/media';
import type { AnnotationDisplayMode } from '@/entities/settings';

const EMPTY_SELECTED_TERMS: ReadonlySet<string> = new Set();

export interface SubtitleActionHandlers {
  onQuickAdd: () => void;
  onEditCard: () => void;
  onUpdateCurrentCard: () => void;
  onGenerateNative: () => void;
  generateNativeEnabled: boolean;
  cueListTokenize: CueListTokenize | null;
}

export interface UseSubtitleActionsDeps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly offsetMs: number;
}

/** Find current target cue text by playback time. */
function findCurrentCueText(cues: readonly SrtCue[], currentMs: number): string {
  const cue = cues.find((c) => currentMs >= c.start && currentMs <= c.end);
  return cue?.text ?? '';
}

export function useSubtitleActions(deps: UseSubtitleActionsDeps): SubtitleActionHandlers {
  const { videoRef, offsetMs } = deps;
  const [generateNativeEnabled, setGenerateNativeEnabled] = useState(false);
  const [cueListTokenize, setCueListTokenize] = useState<CueListTokenize | null>(null);
  const webTextCtrlRef = useRef<WebTextDictionaryController | null>(null);
  const subtitleTokenizeRef = useRef<SubtitleTokenizeController | null>(null);
  const dictionaryPopupRef = useRef<DictionaryPopupSettings>(DEFAULT_DICTIONARY_POPUP_SETTINGS);

  // Cues from global store (driven by SubtitleCueEngine).
  const targetCues = useCuesStore((s) => s.targetCues);

  // Create webTextCtrl on mount — owns Card Creator dialog + dictionary popup.
  useEffect(() => {
    const ctrl = createWebTextDictionaryController({
      container: document.body,
      dictionaryPopupSettings: DEFAULT_DICTIONARY_POPUP_SETTINGS,
      cardCreatorSettings: DEFAULT_CARD_CREATOR_SETTINGS,
      hasVideo: true,
      video: videoRef.current ?? undefined,
      getTargetCues: () => useCuesStore.getState().targetCues,
    });
    webTextCtrlRef.current = ctrl;

    let subtitleLang = '';
    let lastSyncedTarget: readonly SrtCue[] | null = null;
    let lastSyncedNative: readonly SrtCue[] | null = null;
    let rafId = 0;

    const syncSubtitleCues = (): void => {
      const subtitleCtrl = subtitleTokenizeRef.current;
      if (!subtitleCtrl) return;
      const s = useCuesStore.getState();
      if (s.targetCues !== lastSyncedTarget || s.nativeCues !== lastSyncedNative) {
        lastSyncedTarget = s.targetCues;
        lastSyncedNative = s.nativeCues;
        subtitleCtrl.setCues(s.targetCues, s.nativeCues);
      }
      subtitleCtrl.render(s.targetActiveIndex, s.nativeActiveIndex);
    };

    // React commits the new cue text after the store fires — re-render the
    // overlay tokenization on the next frame so a fresh DOM line binds.
    const scheduleSubtitleSync = (): void => {
      syncSubtitleCues();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncSubtitleCues);
    };

    const openTokenDictionary = (
      langCode: string,
      term: string,
      element: HTMLElement,
      contextSentence: string,
      event?: ClickModifierState,
      cursorOffset?: number,
    ): void => {
      const dp = dictionaryPopupRef.current;
      if (!dp.enabled || (event && !modifierMatches(dp.triggerMode, event))) return;
      const request: LookupRequest = {
        term,
        langCode,
        contextSentence,
        cursorOffset: cursorOffset ?? Number(element.getAttribute('data-tihoka-start') ?? 0),
      };
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      webTextCtrlRef.current?.handleLookup(
        request,
        requestId,
        element.getBoundingClientRect(),
        element,
      );
    };

    const ensureSubtitleTokenize = (
      langCode: string,
      readingDisplay: AnnotationDisplayMode,
      glossDisplay: AnnotationDisplayMode,
      glossTargetLanguage: string,
    ): void => {
      if (subtitleLang === langCode) return;
      subtitleLang = langCode;
      subtitleTokenizeRef.current?.destroy();
      subtitleTokenizeRef.current = null;
      lastSyncedTarget = null;
      lastSyncedNative = null;
      if (langCode === '') return;
      const subtitleCtrl = createSubtitleTokenizeController({
        langCode,
        readingDisplay,
        glossDisplay,
        glossTargetLanguage,
        getLineElements: () => ({
          target: document.querySelector<HTMLElement>(
            '[data-tihoka-id="subtitle-block"] [data-role="target"] > span:not([data-tihoka-id])',
          ),
          native: document.querySelector<HTMLElement>(
            '[data-tihoka-id="subtitle-block"] [data-role="native"] > span:not([data-tihoka-id])',
          ),
        }),
        getExtraShadowRoots: () => {
          const panel = document.querySelector<HTMLElement>(SPLIT_VIEW_PANEL_SELECTOR);
          return panel?.shadowRoot ? [panel.shadowRoot] : [];
        },
        onOpenDictionary: (term, element, contextSentence, event, cursorOffset) =>
          openTokenDictionary(langCode, term, element, contextSentence, event, cursorOffset),
        getPopupStatusTarget: () => webTextCtrlRef.current?.getPopupStatusTarget() ?? null,
      });
      subtitleCtrl.enable();
      subtitleTokenizeRef.current = subtitleCtrl;
      syncSubtitleCues();
    };

    const applySettings = (settings: Settings): void => {
      dictionaryPopupRef.current = settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS;
      ctrl.updateSettings({
        dictionaryPopup: settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
        cardCreator: settings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
        subtitleOverlayNativeLanguage: settings.subtitleOverlayNativeLanguage,
      });
      const langCode = getActiveProfileSettings(settings)?.resourceLangCode
        ?? (settings.subtitleOverlayTargetLanguage || '');
      const readingDisplay = settings.readingDisplay ?? 'off';
      const glossDisplay = settings.glossDisplay ?? 'off';
      const glossTargetLanguage = settings.subtitleOverlayNativeLanguage ?? '';
      ensureSubtitleTokenize(langCode, readingDisplay, glossDisplay, glossTargetLanguage);
      // Live-switch modes on an existing controller when only the mode moved.
      subtitleTokenizeRef.current?.setReadingDisplay(readingDisplay);
      subtitleTokenizeRef.current?.setGlossDisplay(glossDisplay);
      subtitleTokenizeRef.current?.setGlossTargetLanguage(glossTargetLanguage);
      if (langCode === '') {
        setCueListTokenize(null);
        return;
      }
      setCueListTokenize((prev) => {
        if (
          prev?.langCode === langCode &&
          prev.readingDisplay === readingDisplay &&
          prev.glossDisplay === glossDisplay &&
          prev.glossTargetLanguage === glossTargetLanguage
        ) return prev;
        return {
          langCode,
          readingDisplay,
          glossDisplay,
          glossTargetLanguage,
          onTokenClick: (term, element, contextSentence, event, cursorOffset) =>
            openTokenDictionary(langCode, term, element, contextSentence, event, cursorOffset),
          onTokenHover: (term) => subtitleTokenizeRef.current?.setHoveredTerm(term),
          onTokenCtrlClick: (term) => subtitleTokenizeRef.current?.toggleSelectedTerm(term),
          selection: {
            getTerms: () =>
              subtitleTokenizeRef.current?.getState().selectedTerms ?? EMPTY_SELECTED_TERMS,
            subscribe: (cb) =>
              subtitleTokenizeRef.current?.subscribeSelection(cb) ?? (() => {}),
          },
        };
      });
    };

    void loadSettings().then(applySettings);
    const onSettingsChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local' || !(STORAGE_KEYS.SETTINGS in changes)) return;
      void loadSettings().then(applySettings);
    };
    onStorageChanged(onSettingsChange);
    const unsubscribeCues = useCuesStore.subscribe(scheduleSubtitleSync);

    return () => {
      unsubscribeCues();
      cancelAnimationFrame(rafId);
      removeOnStorageChangedListener(onSettingsChange);
      ctrl.destroy();
      webTextCtrlRef.current = null;
      subtitleTokenizeRef.current?.destroy();
      subtitleTokenizeRef.current = null;
      subtitleLang = '';
      setCueListTokenize(null);
    };
  }, [videoRef]);

  // Update generateNativeEnabled when cues or settings change.
  useEffect(() => {
    void loadSettings().then((settings) => {
      const sl = settings.subtitleOverlayTargetLanguage ?? '';
      const tl = settings.subtitleOverlayNativeLanguage ?? '';
      setGenerateNativeEnabled(sl !== '' && tl !== '' && sl !== tl && targetCues.length > 0);
    }).catch(() => setGenerateNativeEnabled(false));
  }, [targetCues]);

  /** Build SubtitleActionContext from current state. */
  const buildContext = useCallback((): SubtitleActionContext => {
    const video = videoRef.current;
    if (!video) throw new Error('useSubtitleActions: video ref is null');

    return {
      video,
      container: document.body,
      webTextCtrl: webTextCtrlRef.current ?? undefined,
      getTargetCues: () => useCuesStore.getState().targetCues,
      getNativeCues: () => useCuesStore.getState().nativeCues,
      getCurrentTargetText: () => {
        const cues = useCuesStore.getState().targetCues;
        const currentMs = video.currentTime * 1000 + offsetMs;
        return findCurrentCueText(cues, currentMs);
      },
      getCurrentNativeText: () => {
        const cues = useCuesStore.getState().nativeCues;
        const currentMs = video.currentTime * 1000 + offsetMs;
        return findCurrentCueText(cues, currentMs);
      },
      getOffsetMs: () => offsetMs,
      showToast: (message, options) => {
        // ponytail: simple console toast for now — local-player doesn't have
        // the subtitle toast system. Can be upgraded to a real toast later.
        const variant = options?.variant ?? 'info';
        logger.info(`[local-player] ${variant}: ${message}`);
      },
      loadSettingsOrToast: async (_container: HTMLElement) => {
        try {
          return await loadSettings();
        } catch {
          console.error('[local-player] Cannot load settings — storage unavailable.');
          return undefined;
        }
      },
      cardCreator: createCardCreatorActionPorts(),
    };
  }, [videoRef, offsetMs]);

  const handleAction = useCallback((action: CardCreatorAction) => {
    const ctx = buildContext();
    void handleCardCreatorAction(ctx, action);
  }, [buildContext]);

  const handleGenerate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const ctx = buildContext();
    const targetCuesSnapshot = [...useCuesStore.getState().targetCues];

    void startGenerateNative(targetCuesSnapshot, {
      onChunkTranslated: (translatedCues) => {
        useCuesStore.getState().setCues(targetCuesSnapshot, translatedCues);
      },
      onError: (msg) => {
        ctx.showToast(msg, { variant: 'error' });
        setGenerateNativeEnabled(true);
      },
      onComplete: () => {
        ctx.showToast(t('player.toast.nativeGenerated'), { variant: 'success' });
        setGenerateNativeEnabled(true);
      },
    }).then((result) => {
      if (!result) {
        ctx.showToast(t('player.toast.nativeUnavailable'), { variant: 'info' });
        return;
      }
      ctx.showToast(t('player.toast.nativeGenerating'), { variant: 'info' });
      setGenerateNativeEnabled(false);
    });
  }, [videoRef, buildContext]);

  return useMemo(() => ({
    onQuickAdd: () => handleAction('quick-update'),
    onEditCard: () => handleAction('edit-card'),
    onUpdateCurrentCard: () => handleAction('update-current'),
    onGenerateNative: handleGenerate,
    generateNativeEnabled,
    cueListTokenize,
  }), [handleAction, handleGenerate, generateNativeEnabled, cueListTokenize]);
}
